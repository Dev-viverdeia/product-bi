-- A régua e_cliente no valor parado, e as oito exceções que faltava declarar
--
-- Segundo corte da auditoria de 18/08. O primeiro conferiu COERÊNCIA (âncoras,
-- abas, menus, RPC × hook) e achou dois defeitos. Este confere SEMÂNTICA, e
-- começa pela régua que já custou caro: `e_cliente`.
--
-- O CLAUDE.md é literal: "RPC nova que toca fato de grão-cliente junta
-- dim_usuario com e_cliente — SEM EXCEÇÃO NÃO DECLARADA". A auditoria de 13/08
-- achou 5 de 59 RPCs sem a régua, com desvio de até 30,8%. Hoje são 30 RPCs
-- lendo fato sem ela — e a maior parte é legítima, mas **nenhuma declarava o
-- motivo**. Oito não tinham `comment on function` nenhum.
--
-- Exceção não declarada é indistinguível de esquecimento. Foi assim que os
-- 30,8% entraram.
--
-- ============================================================================
-- O DEFEITO: bi_valor_nao_consumido
-- ============================================================================
--
-- `marts.fact_credito_mentoria` tem `user_id` e a função não usava. Medido:
--
--   Créditos de mentoria individual        hoje    com a régua
--     disponíveis                           280            195
--     usados                                 60             31
--     taxa de uso                        17,65%         13,72%
--     beneficiários                          61             56
--
--   Créditos de mentoria estratégica     105/0/75       105/0/75  (sem mudança)
--
-- **85 dos 280 créditos "parados" — 30% — são de quem não é cliente**, e quase
-- metade dos usos também (29 de 60). O card se chama "valor contratado não
-- consumido" e existe para decisão comercial: ele inflava o problema em 43% e
-- publicava taxa de uso quase 4 pontos acima da real.
--
-- ⚠️ O denominador aqui é `disponivel + usado`, não `disponivel`. Registrei o
-- efeito errado uma vez por não ter lido a função antes de dividir — a conta
-- certa é a de cima.
--
-- O braço "Pool de mentoria das organizações" NÃO muda: sai de
-- `marts.dim_organizacao`, que é grão de organização e já filtra por `ativa`.
--
-- ============================================================================
-- AS OITO EXCEÇÕES, CADA UMA COM O MOTIVO MEDIDO
-- ============================================================================
--
-- Nenhuma vira correção — as oito são legítimas, e duas delas seriam DEFEITO se
-- alguém "consertasse" aplicando a régua:
--
--   bi_erros_login          fact_erro_login  não tem user_id (id, criado_em,
--   bi_erros_por_tela       fact_erro_cliente  categoria/tela, status/origem).
--                           A régua é impossível, não omitida.
--
--   bi_receita_kpis         fact_fatura: das 1.119 linhas, só 3 são de
--   bi_receita_mensal       não-cliente — mas 283 (25,3%) NÃO TÊM user_id.
--   bi_receita_saude_cobranca  Um join com a régua descartaria essas 283 e
--                           derrubaria a receita publicada. Aplicar aqui
--                           criaria defeito, não corrigiria nenhum.
--
--   bi_entrada_kpis         grão é o CONVITE, não a pessoa: fact_convite tem
--   bi_entrada_aceite_convite  criado_por e usado_por, e a métrica conta
--                           convite. bi_entrada_kpis também lê fact_erro_login
--                           (sem user_id) e fact_onboarding.
--
--   bi_onboarding_abandono  fact_onboarding tem 6,3% de linhas fora da régua
--                           (1.007 de 15.939), mas numerador e denominador
--                           carregam a mesma contaminação e o card publica
--                           FATIA. O absoluto é maior que a base de clientes —
--                           e isso já estava dito no calculador de Entrada,
--                           só não na própria função.

-- ---------------------------------------------------------------------------
-- A correção
-- ---------------------------------------------------------------------------

create or replace function public.bi_valor_nao_consumido()
returns table(item text, disponivel bigint, usado bigint, pct_uso numeric, beneficiarios bigint)
language sql stable set search_path to ''
as $function$
  select * from (
    -- Grão de ORGANIZAÇÃO: a régua e_cliente não se aplica, e o filtro de
    -- escopo aqui é `ativa`.
    select 'Pool de mentoria das organizações'::text,
           coalesce(sum(o.pool_mentoria), 0)::bigint,
           coalesce(sum(o.pool_usado), 0)::bigint,
           round(coalesce(sum(o.pool_usado), 0)::numeric
             / nullif(sum(o.pool_mentoria), 0), 4),
           count(*) filter (where o.pool_mentoria > 0)::bigint
    from marts.dim_organizacao o where o.ativa
    union all
    -- Grão de PESSOA: junta a dim com e_cliente, como toda leitura de fato de
    -- grão-cliente. Sem isso, 85 dos 280 créditos disponíveis e 29 dos 60 usos
    -- eram de quem não é cliente — num card que existe para decidir sobre
    -- valor contratado.
    select 'Créditos de mentoria individual',
           coalesce(sum(c.individual_disponivel), 0)::bigint,
           coalesce(sum(c.individual_usado), 0)::bigint,
           round(coalesce(sum(c.individual_usado), 0)::numeric
             / nullif(sum(c.individual_disponivel) + sum(c.individual_usado), 0), 4),
           count(*) filter (where c.individual_disponivel > 0)::bigint
    from marts.fact_credito_mentoria c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente
    union all
    select 'Créditos de mentoria estratégica',
           coalesce(sum(c.estrategico_disponivel), 0)::bigint,
           coalesce(sum(c.estrategico_usado), 0)::bigint,
           round(coalesce(sum(c.estrategico_usado), 0)::numeric
             / nullif(sum(c.estrategico_disponivel) + sum(c.estrategico_usado), 0), 4),
           count(*) filter (where c.estrategico_disponivel > 0)::bigint
    from marts.fact_credito_mentoria c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente
  ) t;
$function$;

comment on function public.bi_valor_nao_consumido() is
  'Valor contratado e não consumido. Os dois braços de crédito aplicam a régua e_cliente (corrigido em 18/08: sem ela, 85 dos 280 créditos individuais disponíveis e 29 dos 60 usos eram de quem não é cliente, e a taxa de uso publicada ficava em 17,65% contra 13,72% real). O braço de pool é grão de ORGANIZAÇÃO e por isso filtra por `ativa`, não por e_cliente. ⚠️ O denominador da taxa é disponivel + usado, não disponivel: crédito usado saiu do disponível na origem.';

-- ---------------------------------------------------------------------------
-- As oito exceções, declaradas onde quem lê a função as encontra
-- ---------------------------------------------------------------------------

comment on function public.bi_erros_login(integer) is
  'Erros de login por categoria. NÃO aplica a régua e_cliente porque ELA É IMPOSSÍVEL AQUI: marts.fact_erro_login não tem user_id (as colunas são id, criado_em, categoria e status). Não é omissão — é o grão do espelho. Quem for espelhar o user_id um dia precisa reavaliar esta função junto.';

comment on function public.bi_erros_por_tela(integer, integer) is
  'Erros de JavaScript por tela. NÃO aplica a régua e_cliente porque marts.fact_erro_cliente não tem user_id (id, criado_em, tipo, tela, origem) — o espelho descarta o dono do erro, que a origem tem. Não é omissão. O roadmap registra o user_id descartado como a evidência de usabilidade mais barata disponível, e repô-lo obriga a reavaliar esta função.';

comment on function public.bi_entrada_kpis(integer) is
  'KPIs da porta de entrada. NÃO aplica a régua e_cliente por GRÃO: conta convite (marts.fact_convite, cujas chaves de pessoa são criado_por e usado_por) e erro de login (marts.fact_erro_login, que não tem user_id). O braço de onboarding lê marts.fact_onboarding, que tem 6,3% de linhas fora da régua — mas publica fatia, com numerador e denominador igualmente contaminados.';

comment on function public.bi_entrada_aceite_convite() is
  'Distribuicao do tempo entre criar o convite e aceita-lo, safra fechada de 30 dias. Nunca aceito NAO separa ignorado de nunca enviado: o rastreamento de envio da plataforma parou em 19/abr/2026. NÃO aplica a régua e_cliente por GRÃO: a unidade é o convite, não a pessoa — marts.fact_convite guarda criado_por e usado_por, e um convite nunca aceito não tem pessoa do outro lado para filtrar.';

comment on function public.bi_onboarding_abandono() is
  'Clientes parados em cada etapa do onboarding. NÃO aplica a régua e_cliente, ao contrário do resto da tela de Entrada: marts.fact_onboarding tem 1.007 linhas fora da régua em 15.939 (6,3%), então o número ABSOLUTO de incompletos é maior que a base de clientes. A fatia se sustenta porque numerador e denominador carregam a mesma contaminação, e é fatia que o card e a regra publicam. Exceção declarada, não esquecimento.';

comment on function public.bi_receita_kpis() is
  'KPIs de receita. NÃO aplica a régua e_cliente, e aplicá-la seria DEFEITO: das 1.119 linhas de marts.fact_fatura, apenas 3 são de não-cliente, mas 283 (25,3%) não têm user_id nenhum — um join com a dim descartaria essas 283 e derrubaria a receita publicada. O grão é a fatura, não a pessoa. ⚠️ A tabela tem 1.119 linhas para 354 faturas distintas (created, status_updated, payment_succeeded); somar valor_brl sem deduplicar por fatura_id infla 3,1x.';

comment on function public.bi_receita_mensal() is
  'Receita por mês. NÃO aplica a régua e_cliente pelo mesmo motivo de bi_receita_kpis: 283 das 1.119 linhas de marts.fact_fatura não têm user_id, e o join com a dim as descartaria. Grão de fatura, não de pessoa.';

comment on function public.bi_receita_saude_cobranca() is
  'Desfecho das cobranças. NÃO aplica a régua e_cliente pelo mesmo motivo de bi_receita_kpis: 283 das 1.119 linhas de marts.fact_fatura não têm user_id. Grão de fatura, não de pessoa.';

-- Sem purga de insights.achado_cache: nenhum dos nove calculadores lê
-- bi_valor_nao_consumido — o de Organizações lê bi_orgs_efeito_master e
-- bi_orgs_kpis. Conferido antes de aplicar.
