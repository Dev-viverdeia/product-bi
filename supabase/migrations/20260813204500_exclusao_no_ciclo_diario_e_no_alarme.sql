-- 1) O passo entra no ciclo, mas DIÁRIO e não a cada 30 min.
--
-- É varredura de conjunto contra o FDW: compara toda chave de sete fatos com a
-- origem. Rodar a cada 30 min pagaria esse custo 48 vezes por dia para encontrar
-- um punhado de exclusões. Exclusão de conta não é evento de minuto.
--
-- 04:10 BRT (07:10 UTC) — depois do ciclo das 04:00 e antes de qualquer pessoa
-- abrir a tela, para que ninguém veja o mart no meio de uma limpeza.
select cron.schedule(
  'bi_propagar_exclusoes',
  '10 7 * * *',
  $$select etl.executar_passo('etl.propagar_exclusoes()')$$
);

-- 2) O alarme precisa enxergar reincidência.
--
-- Sem isto, a correção de hoje é um evento e não uma garantia: se o passo
-- quebrar, as linhas de gente apagada voltam a acumular em silêncio — que é
-- exatamente como o problema nasceu.
create or replace function marts.contar_linhas_de_apagados()
returns bigint
language sql
security definer
stable
set search_path to ''
as $function$
  select
    (select count(*) from marts.fact_progresso_aula f
      where not exists (select 1 from plataforma.profiles p where p.id = f.user_id))
  + (select count(*) from marts.fact_progresso_solucao f
      where not exists (select 1 from plataforma.profiles p where p.id = f.user_id))
  + (select count(*) from marts.fact_certificado f
      where not exists (select 1 from plataforma.profiles p where p.id = f.user_id))
  + (select count(*) from marts.fact_nps_aula f
      where not exists (select 1 from plataforma.profiles p where p.id = f.user_id))
  + (select count(*) from marts.fact_evento f
      where f.user_id is not null
        and not exists (select 1 from plataforma.profiles p where p.id = f.user_id))
  + (select count(*) from marts.fact_pageview f
      where f.user_id is not null
        and not exists (select 1 from plataforma.profiles p where p.id = f.user_id));
$function$;

comment on function marts.contar_linhas_de_apagados() is
  'Quantas linhas dos marts pertencem a quem não existe mais em plataforma.profiles. Deve ser zero; qualquer valor acima disso é o passo etl.propagar_exclusoes() falhando em silêncio.';

revoke all on function marts.contar_linhas_de_apagados() from public, anon, authenticated;
