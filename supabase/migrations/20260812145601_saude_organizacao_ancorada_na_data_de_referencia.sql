-- marts.v_saude_organizacao media "ativo nos ultimos 30 dias" contra now(). Com o pipeline
-- atrasado a janela anda e o dado nao: a organizacao parece esvaziar sem que nada tenha
-- mudado no cliente. Mesma correcao da Fase 0, agora na view que sustenta as tres regras
-- de /organizacoes. A CTE de ancora e materializada de proposito -- data_referencia() e
-- STABLE e, solta no WHERE, ja foi avaliada por linha uma vez neste projeto.
create or replace view marts.v_saude_organizacao as
  with ref as materialized (
    select marts.data_referencia() as corte
  ),
  membros as (
    select u.organization_id, count(*) as membros
    from marts.dim_usuario u
    where u.organization_id is not null and u.e_cliente
    group by u.organization_id
  ),
  ativos as (
    select u.organization_id, count(distinct f.user_id) as ativos_30d
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    cross join ref
    where u.organization_id is not null and f.data_brt > ref.corte - 30
    group by u.organization_id
  ),
  master_ativo as (
    select o.id as org_id,
      exists (
        select 1 from marts.fact_evento f cross join ref
        where f.user_id = o.master_user_id and f.data_brt > ref.corte - 30
      ) as master_ativo
    from marts.dim_organizacao o
    where o.master_user_id is not null
  )
  select o.id, o.nome, o.plano, o.ativa, o.team_limit,
    coalesce(m.membros, 0) as membros,
    coalesce(a.ativos_30d, 0) as ativos_30d,
    round(coalesce(a.ativos_30d, 0)::numeric / nullif(m.membros, 0)::numeric, 4) as pct_time_ativo,
    round(coalesce(m.membros, 0)::numeric / nullif(o.team_limit, 0)::numeric, 4) as pct_assentos_usados,
    coalesce(ma.master_ativo, false) as master_ativo,
    o.pool_mentoria, o.pool_usado
  from marts.dim_organizacao o
  left join membros m on m.organization_id = o.id
  left join ativos a on a.organization_id = o.id
  left join master_ativo ma on ma.org_id = o.id;

comment on view marts.v_saude_organizacao is
  'Saude por organizacao. Janela de 30 dias ancorada em marts.data_referencia() (ultimo dia com dado), nunca em now(): pipeline atrasado nao pode virar queda aparente de atividade.';
