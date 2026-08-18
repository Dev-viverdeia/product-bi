-- Módulo descontinuado para de pedir conserto
--
-- Informação do Mateus em 18/08: **Comunidade e Networking não existem mais**
-- como produto.
--
-- POR QUE ISSO É CORREÇÃO DE NÚMERO, E NÃO ARRUMAÇÃO
--
-- O card de saúde do rastreio classificou hoje quatro eventos calados. Dois
-- deles são de produto que foi encerrado:
--
--   community_post_created   sem_uso            Comunidade
--   community_comment        sem_uso            Comunidade
--   connection_accepted      sem_corroboracao   Networking
--
-- Sem esta migration, o card fica pedindo providência para sempre sobre coisa
-- que não existe: `connection_accepted` seguiria em "sem corroboração" (tom de
-- atenção) esperando um espelho de `member_connections` que ninguém vai
-- construir, e as duas da Comunidade seguiriam ocupando linha como se
-- houvesse decisão a tomar. Card que dá alarme falso todo dia ensina o leitor a
-- ignorar o card — e este é justamente o card que prova os outros.
--
-- O veredito honesto para os três é o mesmo, e é um quarto: `descontinuado`. O
-- evento não sai porque o produto acabou. Não é cano entupido nem torneira
-- fechada: é a casa demolida.
--
-- O HISTÓRICO NÃO É APAGADO, DE PROPÓSITO
--
-- Os 159 eventos de Comunidade e os 1.347 de Networking continuam em
-- marts.fact_evento e continuam contando em qualquer janela que os alcance.
-- Sumir com eles reescreveria o passado — quem olhar 90 dias tem direito de ver
-- que houve 18 ações de Networking naquela janela. O que muda é só o alarme.
--
-- A LISTA DEVOLVE CONJUNTO, PELA MESMA RAZÃO DE 20260818043000
--
-- Régua compartilhada que entra em predicado não pode ser booleano por item:
-- função SQL com cláusula SET não faz inline e passa a ser chamada por linha.

create or replace function marts.modulos_descontinuados()
returns text[]
language sql immutable set search_path to ''
as $function$
  select array['Comunidade', 'Networking']::text[];
$function$;

comment on function marts.modulos_descontinuados() is
  'Módulos que a plataforma encerrou (decisão informada pelo Mateus em 18/08/2026). O rastreio deles não pede conserto: evento calado ali é consequência do fim do produto, e o veredito vira descontinuado em vez de quebrado/sem_uso/sem_corroboracao. O HISTÓRICO NÃO SAI dos fatos — janela que alcance o período em que o módulo existia continua contando as ações dele, porque sumir com elas reescreveria o passado. Devolve conjunto e não booleano por item pelo motivo medido em 20260818043000.';

-- ---------------------------------------------------------------------------
-- O veredito ganha o quarto valor
-- ---------------------------------------------------------------------------

alter table marts.rastreio_corroboracao
  drop constraint rastreio_corroboracao_veredito_check;

alter table marts.rastreio_corroboracao
  add constraint rastreio_corroboracao_veredito_check
  check (veredito in ('quebrado', 'sem_uso', 'sem_corroboracao', 'descontinuado'));

comment on column marts.rastreio_corroboracao.veredito is
  'quebrado = o fato acontece e o evento não sai · sem_uso = ninguém faz mais isso, instrumentação sadia · sem_corroboracao = não há fonte independente espelhada, ou a leitura dela falhou · descontinuado = o módulo foi encerrado, então não há rastreio a consertar. Na dúvida entre os três primeiros o veredito é sempre sem_corroboracao: afirmar sem_uso sem prova é trocar um diagnóstico falso por outro.';

create or replace function etl.corroborar_rastreio()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r          record;
  v_fonte    text;
  v_total    bigint;
  v_desde    bigint;
  v_veredito text;
begin
  for r in
    select rp.tipo, rp.modulo, rp.ultimo_registro
    from marts.rastreio_por_tipo() rp
    where rp.status in ('atrasado', 'parado')
  loop
    v_fonte := null;
    v_total := null;
    v_desde := null;

    -- Módulo encerrado nem chega a ser corroborado: não há pergunta a fazer
    -- sobre o rastreio de um produto que não existe mais, e consultar a fonte
    -- só gastaria uma ida ao FDW para produzir um alarme que ninguém pode
    -- atender.
    if r.modulo = any (marts.modulos_descontinuados()) then
      v_veredito := 'descontinuado';
    else
      begin
        case r.tipo
          when 'solution_started' then
            v_fonte := 'marts.fact_progresso_solucao';
            select count(*),
                   count(*) filter (
                     where (p.iniciado_em at time zone 'America/Sao_Paulo')::date
                           > r.ultimo_registro)
              into v_total, v_desde
            from marts.fact_progresso_solucao p;

          else
            -- Sem fonte independente espelhada. Fica declarado, não adivinhado.
            null;
        end case;
      exception when others then
        -- FDW fora do ar, coluna renomeada na origem, permissão revogada:
        -- qualquer falha de LEITURA vira ausência de corroboração. Nunca
        -- 'sem_uso'.
        v_total := null;
        v_desde := null;
      end;

      v_veredito := case
        when v_fonte is null                then 'sem_corroboracao'
        when v_total is null or v_total = 0 then 'sem_corroboracao'
        when v_desde > 0                    then 'quebrado'
        else                                     'sem_uso'
      end;
    end if;

    insert into marts.rastreio_corroboracao
      (tipo, fonte, registros_na_fonte, fonte_total, ultimo_evento,
       veredito, verificado_em)
    values
      (r.tipo, v_fonte, v_desde, v_total, r.ultimo_registro,
       v_veredito, now())
    on conflict (tipo) do update set
      fonte              = excluded.fonte,
      registros_na_fonte = excluded.registros_na_fonte,
      fonte_total        = excluded.fonte_total,
      ultimo_evento      = excluded.ultimo_evento,
      veredito           = excluded.veredito,
      verificado_em      = excluded.verificado_em;
  end loop;

  delete from marts.rastreio_corroboracao c
  where not exists (
    select 1 from marts.rastreio_por_tipo() rp
    where rp.tipo = c.tipo and rp.status in ('atrasado', 'parado'));
end;
$function$;

comment on function etl.corroborar_rastreio() is
  'Decide, para cada tipo atrasado ou parado, por que ele calou. Módulo em marts.modulos_descontinuados() fecha em descontinuado sem consultar fonte nenhuma — produto encerrado não tem rastreio a consertar. Para o resto, compara o evento com uma fonte independente do mesmo fato desde a última data registrada. Roda no cron diário porque lê foreign table: dentro da RPC seria uma ida à plataforma por render, e o card de saúde passaria a falhar exatamente quando o FDW cai. Qualquer falha de leitura vira sem_corroboracao, nunca sem_uso.';

-- Os dois ramos da Comunidade saíram do CASE junto com o produto: eram os
-- únicos que liam plataforma.community_posts, e agora fecham em descontinuado
-- antes de chegar lá. A régua de sanidade (fonte com zero linha = ilegível)
-- continua valendo para toda fonte que entrar aqui depois.

select etl.corroborar_rastreio();
