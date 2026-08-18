-- `organizacao` também é identificador, e a allowlist tinha um furo
--
-- Correção da migration anterior, achada conferindo o resultado da semeadura.
--
-- O FURO
--
-- A lista de identificadores era `nome` e `email`. Com ela, a semeadura retinha
-- `marts.dim_organizacao.nome` e SERVIA `marts.dim_usuario.organizacao` — que é
-- o mesmo valor, denormalizado na outra tabela. Retenção que o vizinho desfaz
-- não é retenção.
--
-- Varri os marts por nome de coluna antes de corrigir, em vez de tapar só o
-- caso que eu tinha visto:
--
--   identificador direto : nome (dim_organizacao, dim_usuario)
--                          email (dim_usuario, fact_fatura)
--                          organizacao (dim_usuario, master_snapshot)
--   hash                 : contato_hash, email_hash, empresa_hash,
--                          solicitante_email_hash
--   chave                : empresa_id, organization_id, user_id
--   conteúdo             : titulo, slug, path, tela, proxima_tela
--
-- `master_snapshot.organizacao` e `fact_fatura.email` são os dois que a varredura
-- pegou e que uma lista escrita à mão teria perdido — motivo de a régua viver
-- numa função e a semeadura sair do schema vivo, não de digitação.
--
-- O QUE NÃO ENTRA NA LISTA, E POR QUE
--
-- Hash e chave ficam SERVIDOS de propósito: o contrato de PII manda usar chave
-- no lugar do valor quando a análise só precisa distinguir, e é exatamente para
-- isso que eles existem. `count(distinct)` e join funcionam igual sobre hash.
--
-- ⚠️ Fica registrado o que já está no CLAUDE.md e continua valendo aqui: o hash
-- do Pulse é reversível por comparação — dá para hashear um valor conhecido e
-- procurar. É capacidade conhecida e NÃO UTILIZADA, e servir a coluna no
-- Explorar não muda isso: quem quiser fazer essa comparação já podia fazê-la
-- pelas RPCs de CS. O controle aqui é de propósito declarado, não de acesso.
--
-- Conteúdo (título de aula, slug, path de tela) fica servido porque é o objeto
-- do produto, não a pessoa que o usou.

create or replace function marts.identificadores_diretos()
returns text[]
language sql immutable set search_path to ''
as $function$
  select array['nome', 'email', 'organizacao']::text[];
$function$;

comment on function marts.identificadores_diretos() is
  'Nomes de coluna que identificam uma pessoa ou conta DIRETAMENTE e por isso não são servidos pelo Explorar. NÃO inclui hash nem chave (user_id, *_hash, empresa_id): o contrato de PII manda usar chave no lugar do valor, e é para isso que elas existem. Também não inclui conteúdo (titulo, slug, path), que é o objeto do produto e não a pessoa. Devolve conjunto e não booleano por item pelo motivo medido em 20260818043000. Mudar esta lista exige resemear marts.explorar_catalogo na mesma migration, senão a allowlist congelada segue com a régua velha.';

-- Resemeadura com a régua corrigida. O catálogo é reconstruído do zero de
-- propósito: aplicar a diferença deixaria coluna já admitida servida para
-- sempre, que é o oposto do que "congelado" deve significar.
truncate marts.explorar_catalogo;

do $seed$
declare
  v_identificadores text[] := marts.identificadores_diretos();
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
      and c.relname not in ('explorar_catalogo', 'rastreio_corroboracao')
      and coalesce(s.n_live_tup, 0) > 0
    group by c.relname, s.n_live_tup
  loop
    insert into marts.explorar_catalogo (tabela, colunas_servidas, colunas_retidas, linhas)
    values (r.tabela, r.servidas, r.retidas, r.linhas);
  end loop;
end;
$seed$;

-- Guarda: se algum identificador direto sobrou servido, a migration aborta.
-- Sem isso, um erro na régua sairia daqui como allowlist válida — e o único
-- controle desta camada é ela, já que não há papel de admin.
do $guarda$
declare
  v_vazamento text;
begin
  select string_agg(format('%s.%s', c.tabela, col), ', ')
    into v_vazamento
  from marts.explorar_catalogo c
  cross join unnest(c.colunas_servidas) col
  where col = any (marts.identificadores_diretos());

  if v_vazamento is not null then
    raise exception 'A allowlist do Explorar está servindo identificador direto: %', v_vazamento;
  end if;
end;
$guarda$;
