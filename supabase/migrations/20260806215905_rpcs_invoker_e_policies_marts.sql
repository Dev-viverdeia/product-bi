-- Zera os warnings 0029: RPCs bi_* passam a SECURITY INVOKER, com leitura dos
-- marts concedida a authenticated via grant + RLS explícita. O schema marts
-- continua FORA da API REST (não listado em exposed schemas) — o acesso é só
-- através das funções em public.
-- bi_ultima_sincronizacao passa a ler o carimbo de marts.dim_usuario (mesmo
-- dado), eliminando a necessidade de expor o schema etl.

grant usage on schema marts to authenticated;
grant select on marts.dim_usuario, marts.fact_evento, marts.fact_pageview to authenticated;

create policy "leitura_bi" on marts.dim_usuario for select to authenticated using (true);
create policy "leitura_bi" on marts.fact_evento for select to authenticated using (true);
create policy "leitura_bi" on marts.fact_pageview for select to authenticated using (true);

alter function public.bi_visao_geral_kpis(integer) security invoker;
alter function public.bi_atividade_diaria(integer) security invoker;
alter function public.bi_heatmap_navegacao(integer) security invoker;
alter function public.bi_eventos_por_tipo(integer) security invoker;
alter function public.bi_top_telas(integer, integer) security invoker;

create or replace function public.bi_ultima_sincronizacao()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select max(sincronizado_em) from marts.dim_usuario;
$$;
