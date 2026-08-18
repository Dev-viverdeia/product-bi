-- A âncora das 35 regras segue o padrão de três abas
--
-- O Mateus fechou o padrão de tela em 18/08: **toda tela tem as MESMAS três
-- abas, nesta ordem — `Gráficos` (o dado), `Análise` (a leitura), `Plano` (a
-- sugestão)**. As abas por pergunta (`retencao`, `funil`, `catalogo`,
-- `implementacao`, `adocao`, `impacto`, `telas`, `fluxos`, `safra`, `porta`,
-- `onboarding`, `conclusao`, `qualidade`, `curadoria`, `uso`, `funciona`,
-- `risco`, `receita`) deixam de existir; o agrupamento por pergunta passa a ser
-- feito pela `SecaoDeAnalise`, que já existe e já faz isso dentro da aba.
--
-- POR QUE ESTA MIGRATION EXISTE, E POR QUE ELA É O PASSO MAIS ARRISCADO
--
-- `insights.regra.ancora_aba` guarda o VALOR da aba para onde o link "ver o
-- gráfico que sustenta" navega. O CLAUDE.md já registra a armadilha em prosa:
--
--   "O `valor` da aba é o mesmo texto que a regra grava em `ancora_aba`.
--    Renomear a aba sem renomear no catálogo quebra o link em silêncio: ele
--    troca de aba e não rola para nada."
--
-- Medido antes de mexer: **18 pares (tela, ancora_aba) distintos**, e só dois já
-- apontavam para uma aba que sobrevive (`organizacoes` -> `graficos`, e as três
-- de `visao-geral`, que estão em NULL e caem no fallback do front). As outras
-- **28 regras apontam para aba que vai deixar de existir.** Sem este UPDATE, 28
-- dos 35 links do produto quebrariam sem erro nenhum, em 8 telas.
--
-- O ALVO É ÚNICO, E ISSO SIMPLIFICA A TRAVA
--
-- Com o padrão uniforme, todo achado aponta para o mesmo lugar: a aba do dado.
-- Então `ancora_aba` passa a ser sempre 'graficos' — e o CI ganha uma trava
-- barata que faltava: **todo módulo tem de ter uma aba de valor `graficos`**
-- (`contrato-de-shell.test.ts`). Antes, a única proteção era a frase no
-- CLAUDE.md, que não reprova build nenhum.
--
-- NULL SAI DE CENA, DE PROPÓSITO
--
-- As três de `visao-geral` estavam em NULL e funcionavam por acidente: o front
-- faz `achado.ancora_aba ?? 'graficos'`. Depender de fallback para o caso
-- normal é deixar a régua em dois lugares — passa a ser explícito no catálogo.
--
-- A PURGA DO CACHE É OBRIGATÓRIA AQUI, E NÃO É RITUAL
--
-- `insights.achado_cache` guarda o achado inteiro serializado, `ancora_aba`
-- incluída. Sem a purga, as nove telas continuariam servindo a âncora VELHA a
-- partir do cache, apontando para abas que não existem mais — e o sintoma seria
-- exatamente o que esta migration existe para evitar. É o caso que a regra do
-- CLAUDE.md descreve ("migration que mexe em regra termina com delete"), agora
-- valendo para todas as telas de uma vez.

update insights.regra
set ancora_aba = 'graficos'
where ancora_aba is distinct from 'graficos';

-- Guarda: se sobrou âncora fora do padrão, aborta. O UPDATE acima é amplo de
-- propósito, e uma regra nova inserida no meio de outra migration não pode
-- passar por aqui sem ser vista.
do $guarda$
declare
  v_fora text;
begin
  select string_agg(format('%s/%s -> %s', r.tela, r.id, coalesce(r.ancora_aba, 'NULL')), ', ')
    into v_fora
  from insights.regra r
  where r.ancora_aba is distinct from 'graficos';

  if v_fora is not null then
    raise exception 'Regra com âncora fora do padrão de três abas: %', v_fora;
  end if;
end;
$guarda$;

-- Toda tela, porque toda tela teve regra tocada. Chave é
-- (tela|período|recorte|data do dado), então o `like '%'` é o conjunto inteiro.
delete from insights.achado_cache;
