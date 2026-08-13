-- Frescor com a nona fonte.
--
-- `max(dia)::timestamptz` interpretava a data no fuso da SESSAO (UTC) e a view
-- convertia de novo para BRT: 13/08 virava 12/08 e o card publicaria um dia a
-- menos. As outras oito fontes guardam timestamptz de verdade e nao sofrem
-- disso; `dia` ja e data em semantica BRT e nao pode passar por essa ida e volta.
-- `::timestamp at time zone 'America/Sao_Paulo'` le a data como hora de parede
-- de Sao Paulo, que e o que ela e.
--
-- A ordem das colunas repete a da view anterior porque `create or replace view`
-- nao aceita reordenar nem renomear -- e o drop levaria junto a bi_cs_frescor e
-- o front.
create or replace view marts.v_cs_frescor as
with fontes as (
  select 'atendimento' as tabela, count(*) as linhas, max(carregado_em) as carregado_em,
         max(abriu_em) as ultimo_evento, 7 as limite_dias from marts.fact_cs_atendimento
  union all
  select 'disparo', count(*), max(carregado_em), max(criado_em), 10 from marts.fact_cs_disparo
  union all
  select 'envio', count(*), max(carregado_em), max(criado_em), 10 from marts.fact_cs_envio
  union all
  select 'avulso', count(*), max(carregado_em), max(criado_em), 10 from marts.fact_cs_disparo_avulso
  union all
  select 'card', count(*), max(carregado_em), max(entrou_na_etapa_em), 10 from marts.fact_cs_card
  union all
  select 'movimento', count(*), max(carregado_em), max(criado_em), 5 from marts.fact_cs_movimento
  union all
  select 'cancelamento', count(*), max(carregado_em), max(solicitado_em), 30 from marts.fact_cs_cancelamento
  union all
  select 'empresa', count(*), max(carregado_em), max(carregado_em), 7 from marts.dim_cs_empresa
  union all
  select 'status_diario', count(*), max(carregado_em),
         max(dia)::timestamp at time zone 'America/Sao_Paulo', 2
    from marts.fact_cs_status_diario
),
leitura as (select max(carregado_em) as ultima from fontes)
select
  f.tabela,
  f.linhas,
  f.carregado_em,
  l.ultima as ultima_leitura,
  f.ultimo_evento,
  (f.ultimo_evento at time zone 'America/Sao_Paulo')::date as ultimo_evento_brt,
  round(extract(epoch from (now() - f.ultimo_evento)) / 86400, 1) as dias_sem_evento,
  f.limite_dias,
  (f.ultimo_evento < now() - make_interval(days => f.limite_dias)) as fonte_parada,
  (l.ultima < now() - interval '90 minutes') as carga_defasada
from fontes f cross join leitura l;

comment on view marts.v_cs_frescor is
  'Frescor por fonte de CS. Separa DUAS coisas que a tela precisa distinguir: carga_defasada (o nosso sync parou) e fonte_parada (a origem parou de produzir). Cada fonte tem o proprio limite, porque cadencia diferente nao aceita regua unica.';
