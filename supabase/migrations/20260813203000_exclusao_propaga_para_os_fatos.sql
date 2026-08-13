-- Exclusão propaga para os fatos
--
-- A disciplina 3 do contrato de PII diz: "se a plataforma apaga alguém, o mart
-- apaga junto". A dimensão cumpria; os fatos não. Medido em 13/08/2026: 211
-- pessoas apagadas de `profiles` com 4.662 linhas vivas nos nossos espelhos
-- (3.149 em evento, 629 em aula, 524 em pageview, 222 em nps, 110 em solução,
-- 28 em certificado).
--
-- POR QUE O SYNC NÃO PEGAVA ISSO. O sync é incremental por watermark: lê linhas
-- com `updated_at` maior que a marca. Linha apagada não tem `updated_at` — ela
-- simplesmente deixa de existir. Nenhuma quantidade de sync incremental
-- encontraria uma exclusão. Precisa de um passo próprio, que compara conjuntos.
--
-- DOIS CRITÉRIOS, E NÃO UM. A primeira versão desta correção reconciliava só por
-- chave (apagar linha cujo `id` sumiu da origem) e teria resolvido 438 das 4.662
-- linhas. O resto escapava porque a PLATAFORMA apagou o perfil e deixou a
-- atividade órfã no banco dela: 33 dos 43 fantasmas de `fact_progresso_aula`
-- ainda têm linha na origem. Espelhar aquilo é fiel à origem e errado pelo
-- contrato — a pessoa pediu para sumir.
--
--   (a) por PESSOA  — a linha é de alguém que não existe mais em `profiles`
--   (b) por CHAVE   — o `id` não existe mais na origem
--
-- (b) NÃO se aplica a pageview e navegação: a plataforma purga navegação com
-- mais de 30 dias e o BI guarda de propósito. Reconciliar por chave ali apagaria
-- justamente o arquivo que é o nosso maior valor.

create or replace function etl.propagar_exclusoes()
returns table (tabela text, criterio text, linhas_removidas bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_profiles bigint;
  v_dim      bigint;
  v_n        bigint;
begin
  select count(*) into v_profiles from plataforma.profiles;
  select count(*) into v_dim      from marts.dim_usuario;

  /*
    GUARDA DE SANIDADE — não é zelo excessivo, é a diferença entre uma correção e
    um incidente. Toda a lógica abaixo apaga com base em "não existe na origem".
    Se o FDW cair, se a credencial expirar ou se a consulta remota voltar vazia,
    "não existe" passa a ser verdade para TODAS as linhas e esta função apaga os
    marts inteiros — em silêncio, dentro do cron, de madrugada.

    O piso é 90% da dimensão porque `profiles` é sempre maior que `dim_usuario`
    (a dim recorta), então uma origem saudável nunca chega perto disso.
  */
  if v_profiles < greatest((v_dim * 0.9)::bigint, 100) then
    raise exception
      'origem implausível: % perfis contra % na dim. Exclusão NÃO propagada — provável falha de FDW.',
      v_profiles, v_dim;
  end if;

  -- (a) POR PESSOA ---------------------------------------------------------
  create temp table if not exists _apagados (user_id uuid primary key) on commit drop;
  delete from _apagados;
  insert into _apagados (user_id)
  select p.user_id from (
    select user_id from marts.fact_progresso_aula    where user_id is not null
    union select user_id from marts.fact_progresso_solucao where user_id is not null
    union select user_id from marts.fact_certificado       where user_id is not null
    union select user_id from marts.fact_nps_aula          where user_id is not null
    union select user_id from marts.fact_evento            where user_id is not null
    union select user_id from marts.fact_pageview          where user_id is not null
    union select user_id from marts.fact_navegacao         where user_id is not null
  ) p
  where not exists (select 1 from plataforma.profiles pr where pr.id = p.user_id);

  delete from marts.fact_progresso_aula    where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_aula'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_progresso_solucao where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_solucao'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_certificado       where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_certificado'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_nps_aula          where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_nps_aula'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_evento            where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_evento'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_pageview          where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_pageview'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  delete from marts.fact_navegacao         where user_id in (select user_id from _apagados);
  get diagnostics v_n = row_count;
  tabela := 'fact_navegacao'; criterio := 'pessoa'; linhas_removidas := v_n; return next;

  -- (b) POR CHAVE ----------------------------------------------------------
  -- Só onde a origem NÃO purga. Ver o comentário do cabeçalho.
  delete from marts.fact_progresso_aula f
   where not exists (select 1 from plataforma.learning_progress o where o.id = f.id);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_aula'; criterio := 'chave'; linhas_removidas := v_n; return next;

  delete from marts.fact_progresso_solucao f
   where not exists (select 1 from plataforma.progress o where o.id = f.id);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_solucao'; criterio := 'chave'; linhas_removidas := v_n; return next;

  delete from marts.fact_certificado f
   where not exists (select 1 from plataforma.learning_certificates o where o.id = f.id);
  get diagnostics v_n = row_count;
  tabela := 'fact_certificado'; criterio := 'chave'; linhas_removidas := v_n; return next;

  delete from marts.fact_nps_aula f
   where not exists (select 1 from plataforma.learning_lesson_nps o where o.id = f.id);
  get diagnostics v_n = row_count;
  tabela := 'fact_nps_aula'; criterio := 'chave'; linhas_removidas := v_n; return next;

  delete from marts.fact_convite f
   where not exists (select 1 from plataforma.invites o where o.id = f.id);
  get diagnostics v_n = row_count;
  tabela := 'fact_convite'; criterio := 'chave'; linhas_removidas := v_n; return next;

  return;
end;
$function$;

comment on function etl.propagar_exclusoes() is
  'Apaga dos marts o que a plataforma apagou: por pessoa (sumiu de profiles) e por chave (id sumiu da origem). Aborta se a origem vier implausivelmente pequena — sem essa guarda, um FDW caído apagaria os marts inteiros.';

revoke all on function etl.propagar_exclusoes() from public, anon, authenticated;

-- `fact_convite` sai por chave e NUNCA por pessoa, de propósito: o convite é um
-- registro da ORGANIZAÇÃO, e apagá-lo porque quem convidou saiu destruiria o
-- funil de entrada da org que continua cliente. Quem some ali é a linha que a
-- origem apagou, não a pessoa.
