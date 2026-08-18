-- Explorar: o dado bruto dos marts, por allowlist congelada
--
-- Segunda metade da camada de dados. A primeira (as linhas que cada tela já
-- leu) subiu sem exposição nova; esta abre os marts, que o navegador hoje NÃO
-- alcança — o schema `marts` não está na API REST, e continua não estando.
--
-- O ACESSO NÃO PASSA POR is_admin(), POR DECISÃO DO MATEUS (18/08)
--
-- Ele decidiu que não haverá papel de admin no BI. Então o contrato de PII do
-- CLAUDE.md, que exige `private.is_admin()` para lista nominal, passa a valer
-- por "quem tem conta no BI" — que é uma das duas saídas que a pendência O do
-- roadmap já listava. A função é SECURITY INVOKER e serve `authenticated`.
--
-- Consequência que fica registrada: o controle deixa de ser de acesso e passa a
-- ser de ARMAZENAMENTO — o que não pode ser visto não pode ser servido. É por
-- isso que a allowlist abaixo é a peça central desta migration, e não um
-- acabamento.
--
-- A RÉGUA NÃO É "GRÃO DE PESSOA", É "IDENTIFICADOR DIRETO"
--
-- A primeira formulação desta fase dizia "deixar os fatos de grão de pessoa de
-- fora". Está errada, e teria esvaziado o Explorar: quase todo fato é de grão
-- de pessoa (carrega `user_id`), inclusive fact_evento e fact_pageview, que são
-- o miolo do arquivo.
--
-- `user_id` é CHAVE pseudônima, e o contrato de PII abençoa chave
-- explicitamente ("chave no lugar do valor quando a análise só precisa
-- distinguir"). Quem não pode sair é identificador direto: nome e e-mail. Hoje
-- eles vivem em marts.dim_usuario, e é só de lá que saem.
--
-- ALLOWLIST NOS DOIS EIXOS, COM PADRÃO SEGURO
--
-- Blocklist falha em silêncio: bastaria alguém espelhar uma coluna `telefone`
-- para ela vazar sem ninguém notar. É a mesma armadilha que o CLAUDE.md já
-- registra sobre máscara por seletor CSS.
--
-- Então:
--   tabela nova no schema  -> NÃO entra no catálogo -> não é explorável
--   coluna nova numa tabela-> NÃO entra no array    -> não é servida
--
-- As duas exigem uma migration para mudar, que é exatamente o ciclo lento que
-- se quer aqui.
--
-- O catálogo é SEMEADO a partir do schema vivo, menos os identificadores
-- declarados. Semear em vez de digitar 38 listas de coluna evita erro de
-- transcrição; congelar o resultado numa tabela é o que dá a semântica de
-- allowlist. As duas coisas juntas, e não uma no lugar da outra.

create table marts.explorar_catalogo (
  tabela           text primary key,
  colunas_servidas text[] not null,
  colunas_retidas  text[] not null default '{}',
  linhas           bigint,
  congelado_em     timestamptz not null default now()
);

alter table marts.explorar_catalogo enable row level security;

create policy leitura_bi on marts.explorar_catalogo
  for select to authenticated using (true);

grant select on marts.explorar_catalogo to authenticated;

comment on table marts.explorar_catalogo is
  'Allowlist do Explorar: quais tabelas de marts podem ser lidas cruas e QUAIS COLUNAS de cada uma. Congelada de propósito nos dois eixos — tabela nova não entra sozinha, coluna nova não passa a ser servida sozinha. Mudar exige migration, que é o ciclo lento desejado. Não é blocklist: bastaria espelhar uma coluna `telefone` para ela vazar sem ninguém notar, que é a mesma armadilha registrada no CLAUDE.md sobre máscara por seletor CSS.';

comment on column marts.explorar_catalogo.colunas_retidas is
  'O que existe na tabela e NÃO é servido, com o nome à vista. Retenção silenciosa faria o explorador concluir que a coluna não existe; declarada, ele sabe que existe e que não sai daqui.';

-- ---------------------------------------------------------------------------
-- A semeadura
-- ---------------------------------------------------------------------------

do $seed$
declare
  -- Identificador DIRETO de pessoa. Chave pseudônima (user_id, *_hash,
  -- *_key) não entra nesta lista de propósito: é o que o contrato de PII
  -- manda usar no lugar do valor.
  v_identificadores text[] := array['nome', 'email'];
  r record;
begin
  for r in
    select c.relname as tabela,
           array_agg(a.attname order by a.attnum)
             filter (where not (a.attname = any (v_identificadores))) as servidas,
           coalesce(array_agg(a.attname order by a.attnum)
             filter (where a.attname = any (v_identificadores)), '{}') as retidas,
           coalesce(s.n_live_tup, 0) as linhas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_stat_user_tables s on s.relid = c.oid
    where n.nspname = 'marts'
      and c.relkind = 'r'
      -- as tabelas de serviço do próprio BI não são dado de produto
      and c.relname not in ('explorar_catalogo', 'rastreio_corroboracao')
      and coalesce(s.n_live_tup, 0) > 0
    group by c.relname, s.n_live_tup
  loop
    insert into marts.explorar_catalogo (tabela, colunas_servidas, colunas_retidas, linhas)
    values (r.tabela, r.servidas, r.retidas, r.linhas);
  end loop;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- O catálogo, para a tela montar o índice
-- ---------------------------------------------------------------------------

create or replace function public.bi_explorar_catalogo()
returns table(tabela text, colunas_servidas text[], colunas_retidas text[], linhas bigint)
language sql stable set search_path to ''
as $function$
  select c.tabela, c.colunas_servidas, c.colunas_retidas, c.linhas
  from marts.explorar_catalogo c
  order by c.linhas desc nulls last, c.tabela;
$function$;

comment on function public.bi_explorar_catalogo() is
  'Índice do Explorar: as tabelas de marts abertas para leitura crua, com as colunas servidas e as retidas de cada uma. As retidas aparecem com o nome à vista, porque esconder a retenção faria o leitor concluir que a coluna não existe.';

revoke execute on function public.bi_explorar_catalogo() from public, anon;
grant execute on function public.bi_explorar_catalogo() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- As linhas
-- ---------------------------------------------------------------------------

create or replace function public.bi_explorar(
  p_tabela text,
  p_limite integer default 100,
  p_offset integer default 0)
returns jsonb
language plpgsql stable set search_path to ''
as $function$
declare
  v_colunas text[];
  v_limite  integer := least(greatest(coalesce(p_limite, 100), 1), 500);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_linhas  jsonb;
begin
  -- O nome da tabela vem do cliente e NUNCA é interpolado sem passar por aqui.
  -- A allowlist é a validação: o que não está no catálogo não existe para esta
  -- função, e o erro nomeia a tabela para o pedido ficar auditável.
  select c.colunas_servidas into v_colunas
  from marts.explorar_catalogo c
  where c.tabela = p_tabela;

  if v_colunas is null then
    raise exception 'A tabela "%" não está no catálogo do Explorar.', p_tabela
      using hint = 'Abrir uma tabela nova exige migration — o catálogo é congelado de propósito.';
  end if;

  -- %I nas duas pontas: o nome já passou pela allowlist, e o quote_ident é a
  -- segunda tranca. Colunas saem do catálogo, nunca do pedido.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
     from (select %s from marts.%I offset %s limit %s) t',
    (select string_agg(format('%I', col), ', ') from unnest(v_colunas) col),
    p_tabela, v_offset, v_limite)
  into v_linhas;

  return jsonb_build_object(
    'tabela', p_tabela,
    'colunas', to_jsonb(v_colunas),
    'offset', v_offset,
    'limite', v_limite,
    'linhas', v_linhas);
end;
$function$;

comment on function public.bi_explorar(text, integer, integer) is
  'Linhas cruas de uma tabela de marts, limitada ao que marts.explorar_catalogo autoriza — tabela E coluna. O nome da tabela vem do cliente e é validado contra o catálogo antes de qualquer interpolação; coluna nunca vem do pedido. Teto rígido de 500 linhas por chamada: o Explorar é para conferir e recortar, não para exportar a base. SECURITY INVOKER, então a RLS dos marts continua valendo.';

revoke execute on function public.bi_explorar(text, integer, integer) from public, anon;
grant execute on function public.bi_explorar(text, integer, integer) to authenticated, service_role;
