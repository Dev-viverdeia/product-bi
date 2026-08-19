-- Ocupação de assentos tira o "não sabemos" do eixo e do corpo 30px
--
-- O DEFEITO
--
-- `bi_orgs_ocupacao` devolvia cinco faixas, e a quinta era 'Sem limite
-- definido' — 1.454 de 1.924 organizações ativas, ou seja, AUSÊNCIA DE DADO
-- desenhada como faixa de ocupação. Duas consequências, as duas no único bloco
-- de destaque (`tone="brand"`) da tela:
--
-- 1. O headline escolhe a maior contagem, então ele publicava "75,6% das orgs
--    em Sem limite definido". O número em corpo 30px da tela era "não sabemos".
-- 2. O eixo escalava até 1.454 e espremia as quatro faixas reais nos 17%
--    iniciais — justamente a comparação que a descrição do card manda fazer
--    ("lotadas são upsell; abaixo de 50%, valor não percebido").
--
-- Sem limite contratado não há ocupação a medir: a organização não está numa
-- faixa baixa, ela está fora da pergunta.
--
-- O CONSERTO
--
-- A função devolve só as quatro faixas reais, e a cobertura vira coluna de
-- janela — `orgs_com_limite`, `orgs_sem_limite`, `orgs_ativas`, iguais em toda
-- linha. Esconder a contagem faria o leitor concluir que a coluna não existe;
-- declará-la fora do eixo é o que separa "medimos e deu baixo" de "não há o que
-- medir". É a mesma disciplina do Explorar, que declara a retenção com o nome
-- do campo em vez de omitir a coluna.
--
-- `pct_das_com_limite` sai do banco e não do front: percentual derivado de
-- contagem no cliente escapa da supressão por amostra. O denominador aqui é a
-- base COM limite (470), não o total — dividir pelo total misturaria de volta o
-- desconhecido que este conserto tira do eixo.
--
-- `drop` e não `create or replace`: o tipo de retorno muda.

drop function if exists public.bi_orgs_ocupacao();

create function public.bi_orgs_ocupacao()
returns table(
  faixa text,
  ordem integer,
  orgs bigint,
  pct_das_com_limite numeric,
  orgs_com_limite bigint,
  orgs_sem_limite bigint,
  orgs_ativas bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select case
        when pct_assentos_usados < 0.5 then 'Menos de 50%'
        when pct_assentos_usados < 0.8 then '50–80%'
        when pct_assentos_usados < 1 then '80–99%'
        else 'Lotada (100%+)'
      end as faixa,
      case
        when pct_assentos_usados < 0.5 then 1
        when pct_assentos_usados < 0.8 then 2
        when pct_assentos_usados < 1 then 3
        else 4
      end as ordem,
      pct_assentos_usados
    from marts.v_saude_organizacao
    where ativa and membros > 0
  ),
  cob as (
    select count(*) filter (where pct_assentos_usados is not null) as com_limite,
           count(*) filter (where pct_assentos_usados is null) as sem_limite,
           count(*) as total
    from base
  )
  select b.faixa, b.ordem, count(*),
         case when c.com_limite >= 30
              then round(count(*)::numeric / c.com_limite, 4) end,
         c.com_limite, c.sem_limite, c.total
  from base b cross join cob c
  where b.pct_assentos_usados is not null
  group by b.faixa, b.ordem, c.com_limite, c.sem_limite, c.total
  order by b.ordem;
$function$;

grant execute on function public.bi_orgs_ocupacao() to authenticated, service_role;

comment on function public.bi_orgs_ocupacao() is
  'Ocupacao de assentos das organizacoes COM limite contratado. A versao anterior devolvia uma quinta faixa Sem limite definido com 1.454 de 1.924 orgs - ausencia de dado como faixa de ocupacao - e ela dominava o eixo e ganhava o headline do bloco de destaque, que publicava 75,6% de nao sabemos. A cobertura continua na resposta, como coluna de janela (orgs_com_limite / orgs_sem_limite / orgs_ativas): fica declarada, fora da comparacao. pct_das_com_limite tem denominador na base com limite, nao no total.';
