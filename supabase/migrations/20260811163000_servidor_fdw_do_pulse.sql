-- Segunda fonte do BI: cs_pulse_platform (ref tfwnxzbjfmmtskdvndcf, us-east-2).
-- Mesmo desenho do plataforma_srv: session pooler, fetch grande, timeout curto.
--
-- FALTA UMA LINHA para isto funcionar, e ela não está aqui de propósito:
--
--   create user mapping for postgres server pulse_srv
--     options (user 'bi_pulse_readonly.tfwnxzbjfmmtskdvndcf', password '<senha>');
--
-- O user mapping é criado à mão pelo Mateus no SQL editor. A senha não entra em
-- migration, repo nem conversa — mesma regra do plataforma_srv.

create server if not exists pulse_srv
  foreign data wrapper postgres_fdw
  options (
    -- pooler e não rota direta: entre projetos Supabase a rota IPv6 não fecha
    host 'aws-0-us-east-2.pooler.supabase.com',
    port '5432',
    dbname 'postgres',
    fetch_size '10000',
    connect_timeout '8'
  );

-- Enums remotos precisam de tipo local homônimo antes do import foreign schema,
-- senão o import falha por tipo desconhecido. Valores conferidos na origem.
do $$
begin
  if to_regtype('public.wa_ticket_status') is null then
    create type public.wa_ticket_status as enum
      ('open','pending','waiting_third_party','solved','closed');
  end if;
  if to_regtype('public.wa_thread_status') is null then
    create type public.wa_thread_status as enum ('open','closed','archived');
  end if;
  if to_regtype('public.wa_ticket_priority') is null then
    create type public.wa_ticket_priority as enum ('low','normal','high','urgent');
  end if;
end $$;

-- Espelho de leitura, fora da API REST — mesmo tratamento do schema plataforma.
create schema if not exists pulse;
comment on schema pulse is
  'Foreign tables do cs_pulse_platform (somente leitura). Importar tabela a tabela: o banco de origem é compartilhado e tem um schema bi volátil que não deve ser lido.';
