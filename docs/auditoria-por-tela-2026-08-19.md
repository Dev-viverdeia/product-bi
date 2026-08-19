# Auditoria por tela — 19/ago/2026

**Como isto foi produzido.** Dez agentes independentes, um por tela, com acesso ao banco e
mandato de conferir cada número contra a RPC que o produz — lendo cada função com
`pg_get_functiondef`, CTE por CTE. Depois dois críticos adversariais tentaram DERRUBAR cada
achado: um refazendo as contas no banco, outro procurando no CLAUDE.md, nos `comment on
function` e no git log se aquilo já era decisão registrada.

**Custo:** 12 agentes, 2,36 milhões de tokens, 647 chamadas de ferramenta.

⚠️ **O que NÃO foi feito: a verificação de navegador.** Nada aqui saiu de olhar a tela
renderizada. Equilíbrio visual, respiro e peso — que é o que "poluído" descreve — continuam
sem verificação, porque a extensão do Chrome não responde nesta sessão e o projeto não tem
Playwright. Esta é a mesma fraqueza declarada em `proposta-densidade-e-hierarquia.md`.

⚠️ **Erro de método, registrado porque muda como ler os números.** A contagem automática de
"quantos sobreviveram à crítica" não funcionou: eu casei achado com veredito por título, e os
críticos reescreveram os títulos. O resultado é que a lista abaixo contém achados CONFIRMADOS
e achados NÃO REVISADOS misturados. Os cinco que eu mesmo refiz em SQL estão marcados
**[conferido por mim]** — o resto é trabalho de agente e merece a mesma desconfiança que
qualquer achado antes de virar conserto.

---

## Resposta curta

**Não, as telas não estão corretas.** São 113 achados, 23 de gravidade alta, em 9 das 10
telas. Nenhum deles é do que foi consertado hoje — são defeitos que já estavam lá e que a
faxina de densidade não tocava.

## Os cinco que eu conferi em SQL, um a um

| tela | o que a tela publica | o que o banco diz |
| --- | --- | --- |
| Entrada | "1.600 clientes" parados no onboarding | **545 deles (34,1%) não são clientes** — `bi_onboarding_abandono` não tem a régua `e_cliente`. Pior que os 30,8% do Consultor que a auditoria de 13/08 registrou |
| Receita | headline "100,0% em Pagamento aprovado" | `pct_do_pago` da linha "Pagamento aprovado" é 1,0000 — **o denominador comparado consigo mesmo** |
| Organizações | "1.925 organizações ativas" no KPI | o card de distribuição da MESMA tela usa 1.957. A diferença são exatamente as **32 orgs sem membro nenhum**, que o KPI exclui e o card inclui |
| Soluções | bloco de destaque com "37,7%" | 18.781 ÷ 49.754, somado no front. **O denominador não está em barra nenhuma** — é o mesmo defeito que Organizações consertou hoje de manhã |
| IA / Builder | card "confiabilidade por etapa" | ver a lista abaixo: a taxa de erro exclui geração que nunca terminou |

## O padrão sistêmico, que vale mais que qualquer item

**Denominador somado no front, em 5 telas.** `cs`, `entrada`, `formacoes`, `ia` e `solucoes`
fazem `reduce((soma, x) => soma + x.campo, 0)` para construir o denominador de um percentual.
Três consequências, e as três já morderam neste projeto:

1. se a RPC corta em N linhas, a soma é sobre lista cortada e o percentual é falso;
2. escapa da supressão por amostra que o banco aplica;
3. o denominador quase nunca está desenhado — o leitor não tem como conferir.

O contrato `percentual não é calculado no front` existe em `contrato-de-tela.test.ts` e cobre
**2 das 10 telas** — por decisão declarada, não por esquecimento: a lista cresce conforme cada
tela migra o cálculo para o banco. O que a auditoria mostra é que a fila está longa.

---

## visao-geral — 10 achados (2 de risco alto)

### Risco alto · "Base pagante" nomeia 15.045 pessoas das quais 12.948 nunca compraram nada

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:179, 213, 214 (+ insights.regra.limiar_descricao e gabarito_acao de vg_penetracao no banco)`
- **Categoria:** numero-errado
- **Evidência:** SQL rodado: `select count(*) filter (where e_cliente) as clientes, count(*) filter (where e_cliente and is_master) as masters, count(*) filter (where e_cliente and not is_master) as convidados from marts.dim_usuario` → clientes 15.045 · masters 2.097 · convidados 12.948 (86,1%). O `base` de `bi_visao_geral_kpis` é literalmente `select count(*) from clientes`, e o CTE `clientes` filtra só por `u.e_cliente` — não por `is_master`. O CLAUDE.md é explícito: "O master user ... é quem comprou o Viver de IA; os demais entram por convite dele". A tela chama esse conjunto de "base pagante" em três lugares (headlineLabel, description do card e prosa da seção) e o motor amplia: `insights.regra.gabarito_acao` de `vg_penetracao` publica "O restante não é churn ainda: é gente pagando sem usar" — rodei `select * from insights.calcular_achados_visao_geral(30)` e ele dispara com severidade `critico` e `parametros {base:15045, ativos:3702, penetracao:0.2461}`. O número 24,6% está certo; o substantivo faz o CEO ler "75% de quem me paga está dormindo" sobre uma população em que só 2.097 pagam.
- **Conserto proposto:** Trocar "base pagante" por "base de clientes" nos três pontos da tela e no `limiar_descricao`/`gabarito_acao` da regra `vg_penetracao` (migration + `delete from insights.achado_cache where chave like 'visao-geral|%'`, senão o cache serve o texto antigo sem erro). Se a pergunta que interessa for mesmo sobre quem comprou, o certo é o card passar a mostrar o recorte comprador × convidado — a régua `is_master` já existe na dim.

### Risco alto · Dois módulos somem do gráfico de compromisso, sem uma palavra — e a linha que existe para declarar isso nunca dispara

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:322-327 (filtro) e 339-351 (bloco que não cobre este caso)`
- **Categoria:** regua-nao-declarada
- **Evidência:** `select * from public.bi_acoes_por_modulo(30)` devolve 6 linhas: Soluções (pct 0.3229), Formações (1.0000), Consultor (1.0000), Builder (1.0000), Mentoria (pct_compromisso NULL, total 12) e Networking (NULL, total 2). A página faz `.filter((m) => m.pct_compromisso != null)` antes de montar `data`, então Mentoria e Networking não entram nem como categoria no eixo. O `CategoryBarChart` já suporta o caminho certo — `value: number | null` + `motivoSemValor`, com rodapé "Sem ... A barra fica de fora — ausência de valor não é zero" (category-bar-chart.tsx:26-33 e 250-265) — e clientes, entrada, ia, formações e cs usam exatamente isso. O bloco `modulosSuprimidos` (linhas 339-351) que a página escreveu para declarar a supressão só olha `suprimido_por`, e na consulta rodada `suprimido_por` é NULL nas SEIS linhas: ele nunca aparece. Efeito de leitura: no mesmo `SecaoDeAnalise`, lado a lado, "Ações por módulo" desenha 6 barras e "O uso é raso ou profundo?" desenha 4, sem nada explicando as duas que faltam.
- **Conserto proposto:** Tirar o `.filter` e mapear as 6 linhas com `value: m.pct_compromisso` (que já é `number | null`) e `motivoSemValor: `amostra de ${formatInt(m.total)} ações (mínimo 30)`` — o piso da RPC é de AÇÕES (`c.total >= 30`), não de clientes, então não dá para reusar `notaAmostra()` cru. Manter o bloco de `modulosSuprimidos` como está: ele cobre a outra guarda (rastreio quebrado), que hoje não está mordendo.

### Atenção · Dois headlines imprimem "0" enquanto carregam e quando dão erro

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:88, 96-99, 360, 403`
- **Categoria:** numero-errado
- **Evidência:** `picoNavegacao` (linhas 96-99) é `reduce(..., 0)` sobre `heatmap.data ?? []` e `rastreiosQuebrados` (linha 88) é `contarQuebrados(rastreio.data ?? [])`. `ChartCard`/`TabelaCard` renderizam `<CardCabecalho {...cabecalho} />` FORA do ramo de estado (chart-card.tsx:68, antes do `isLoading ? ... : isError ? ...`), e `CardCabecalho` imprime `headline` sempre (card-cabecalho.tsx:60-69). Então, no primeiro carregamento e em qualquer erro, o corpo mostra esqueleto ou "Não foi possível carregar os dados" e o cabeçalho afirma "0 pageviews na hora de pico" e "0 rastreios quebrados, com prova" — o segundo lê como "está tudo em ordem" justamente no card que existe para provar os outros. Os outros cinco headlines da tela fazem certo (`mediaDiaria`, `penetracao`, `parteNovos`, `moduloLider`, `parteCompromisso` todos caem em `'—'`). Valores confirmados com dado presente: pico 4.560 (`select max(pageviews) from bi_heatmap_navegacao(30)`) e 1 quebrado (`solution_started`, veredito `quebrado` em `bi_saude_rastreio()`).
- **Conserto proposto:** Fazer as duas derivações devolverem `null` na ausência de dado, como `mediaDiaria` já faz: `const picoNavegacao = useMemo(() => heatmap.data == null ? null : heatmap.data.reduce(...), [heatmap.data])` e `const rastreiosQuebrados = rastreio.data ? contarQuebrados(rastreio.data) : null`, com `headline={x != null ? formatInt(x) : '—'}` nos dois.

### Atenção · "Ações por módulo" é contagem por categoria declarada como comparativo — e a tela depende disso para passar na escada

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:278 (nivel) e 281 (title)`
- **Categoria:** nivel-desonesto
- **Evidência:** `escada.ts` define comparativo como "exige: dois grupos nomeados ou duas janelas, com a margem declarada". O card desenha `CategoryBarChart` com uma medida (`m.total`) por módulo, headline "38,5 mil em Soluções", nenhuma segunda janela, nenhum segundo grupo e nenhuma margem — é "quanto", com denominador visível: descritivo. A calibração das outras nove telas confirma o padrão: todo `nivel="comparativo"` do produto é um par nomeado ("Quem compra retém; quem foi convidado, não", "Usar IA na 1ª semana muda a retenção?", "Quanto maior o time, menor a fatia que aparece"). Consequência medida: `visao-geral-page.tsx` está em `TELAS_NA_REGUA` (escada.test.ts:32); com este card em `descritivo` a composição vira 3 descritivos / 1 comparativo / 2 diagnósticos / 1 prescritivo e `avaliarComposicao` reprova em `comparativosNoMinimo: 2`. Ou seja, a tela cumpre a régua por rótulo, não por conteúdo.
- **Conserto proposto:** Ou o card ganha o segundo canal que o nível promete — a mesma janela anterior por módulo, ou uma `referencia` com a margem escrita, como o card irmão de compromisso já faz — ou ele passa a `nivel="descritivo"` e a tela sai de `TELAS_NA_REGUA` com a dívida escrita no comentário, no padrão que `entrada` já usa (escada.test.ts:34-45). Não trocar só o rótulo.

### Atenção · A prosa da seção afirma "(evento)" sobre um número em que 12.020 das 38.533 ações não são evento

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:274 (prosa da seção) e 284 (description do card)`
- **Categoria:** regua-nao-declarada
- **Evidência:** `bi_acoes_por_modulo` tem dois braços: eventos de `marts.fact_evento` (menos `marts.eventos_aposentados()`, hoje `{solution_started}`) e um braço 2 que injeta início de solução vindo de `marts.fact_progresso_solucao`. Medido: os eventos de Soluções na janela são `solution_viewed` 26.091 + `solution_completed` 422 = 26.513; o braço 2 acrescenta 12.020 linhas (`select count(*) from marts.fact_progresso_solucao p join dim_usuario u ... where iniciado_em::date > data_referencia()-30`), fechando os 38.533 que o headline publica como "38,5 mil em Soluções" — 31,2% do número não é evento. A prosa da seção diz "Os dois primeiros cards contam ação de produto (evento); o mapa de horário conta pageview, que é outra fonte", contrastando duas fontes quando existem três. O card irmão ("O uso é raso ou profundo?") declara o braço 2 na sua description; o card que publica o total, não — a dele diz apenas "Todas as ações de produto do período, agrupadas por módulo".
- **Conserto proposto:** Tirar o "(evento)" da prosa da seção (a distinção que ela quer fazer é evento×pageview, e cabe sem afirmar fonte única) e acrescentar a cláusula na description do card de ações: "início de solução vem do mart de progresso, não do evento" — a mesma régua que o card ao lado já carrega. A prosa tem 192 caracteres, sobra folga até os 240.

### Atenção · Networking aparece como "descontinuado" e como "em dia" na mesma tabela, e com barra no gráfico acima

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:437-439 (StatusPill) — origem em marts.modulos_descontinuados() e etl.corroborar_rastreio()`
- **Categoria:** numero-errado
- **Evidência:** `select * from public.bi_saude_rastreio()` traz `connection_accepted` / Networking / veredito `descontinuado` (a tela pinta a pílula "descontinuado", cujo significado em rastreio.ts é "o módulo foi encerrado") e, três linhas abaixo, `connection_sent` / Networking / status `ativo` / último registro 2026-08-18 / pílula "em dia". Conferi na fonte: `select ... from marts.fact_evento where modulo_do_evento(tipo)='Networking'` → `connection_sent` tem 2 eventos nos últimos 7 dias, último em 2026-08-18. A causa é `marts.modulos_descontinuados()`, que devolve `{Comunidade,Networking}` e fecha o veredito ANTES de consultar fonte alguma. Na mesma tela, o gráfico "Ações por módulo" desenha uma barra de Networking (2 ações em 30 dias), e a ordenação da tabela (`dias_parado desc`) põe as duas linhas contraditórias à vista uma da outra. Isto é sobre o CONTEÚDO do veredito, não sobre o card existir — essa segunda pergunta já está com o Mateus.
- **Conserto proposto:** Ou `modulos_descontinuados()` deixa de listar Networking (o módulo emite `connection_sent` diariamente), ou a régua passa a ser por TIPO de evento e não por módulo — que é o grão em que a contradição some. Requer confirmação do Mateus sobre o que exatamente foi tirado do ar, já que a informação de 18/08 foi "Comunidade e Networking".

### Observação · "1 rastreios quebrados" — o rótulo do headline é plural fixo

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:404`
- **Categoria:** outro
- **Evidência:** `headlineLabel="rastreios quebrados, com prova"` é string constante e `contarQuebrados` devolve 1 hoje (`bi_saude_rastreio()` tem um único veredito `quebrado`: `solution_started`). `formatInt(1)` → "1". A tela imprime "1 rastreios quebrados, com prova". O produto já trata plural condicional em outro lugar do mesmo caminho (`aba-de-dados.tsx`: `fontes.length === 1 ? 'função' : 'funções'`).
- **Conserto proposto:** `headlineLabel={`${rastreiosQuebrados === 1 ? 'rastreio quebrado' : 'rastreios quebrados'}, com prova`}`.

### Observação · Duas descrições de card com 395 e 541 caracteres, contra a régua de "uma ou duas linhas"

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:312 e 405`
- **Categoria:** densidade-ou-ordem
- **Evidência:** Medi as strings: a description de "O uso é raso ou profundo?" tem 395 caracteres e a de "Saúde do rastreio" tem 541 — esta é a MAIOR do produto inteiro (levantei todas com `grep -o 'description="[^"]*"' src/features/*/*-page.tsx | sort por tamanho`: 564 bruto aqui, depois clientes 466 e 435, depois esta mesma tela com 417 bruto). O CLAUDE.md rege "Descrição de card é RÉGUA, não changelog. O que conta, a janela, a exclusão, a armadilha de leitura — em uma ou duas linhas", e o Popover tem `max-w-72`, então 541 caracteres a `text-xs` viram um bloco alto de texto. As três prosas de SEÇÃO passam com folga (164, 192 e 180, teto 240) — o excesso está só nas descrições de card.
- **Conserto proposto:** Cortar cada uma para as duas cláusulas que mudam a leitura do número. Em 405, a cláusula "série que atravessa a data de óbito de um evento lê queda de comportamento onde houve queda de instrumentação" é a única que é armadilha de leitura; as definições dos três vereditos já estão nas pílulas e na linha de evidência ao lado de cada uma. Antes de cortar, achar o destino de cada cláusula — encurtar prosa já apagou régua três vezes neste projeto.

### Observação · Quatro âncoras de card que nenhuma regra do motor aponta

- **Onde:** `src/features/visao-geral/visao-geral-page.tsx:244, 279, 307, 400`
- **Categoria:** codigo-morto
- **Evidência:** `select id, ancora_id from insights.regra where tela='visao-geral'` devolve exatamente duas: `vg_penetracao` → `card-kpis` e `vg_tendencia` → `card-atividade`. A página declara mais quatro ids: `card-composicao` (244), `card-eventos` (279), `card-compromisso` (307) e `card-rastreio` (400). Um grep em `src/` e `supabase/` mostra que `card-eventos` só sobrevive num COMENTÁRIO da migration `20260818110000_duas_regras_voltam_a_publicar_o_que_a_tela_mostra.sql:20`, que descreve a regra removida por publicar número que a tela não mostrava — os outros três não aparecem em lugar nenhum. São restos de regras que saíram.
- **Conserto proposto:** Remover os quatro `id=`, ou — se a intenção for deep-link — declarar isso em comentário. O contrato é "card apontado por achado precisa de id"; id sem achado não tem contrato que o sustente e passa a impressão de que existe um achado que não existe.

### Observação · A ação do achado manda o leitor para "Clientes & Retenção", módulo que se chama "Clientes"

- **Onde:** `insights.regra.gabarito_acao de vg_penetracao (banco) — rótulo real em src/components/layout/nav-items.ts:192`
- **Categoria:** outro
- **Evidência:** `gabarito_acao` de `vg_penetracao` (rodado em `insights.calcular_achados_visao_geral(30)`): "O restante não é churn ainda: é gente pagando sem usar. A lista nominal está em Clientes & Retenção." Os títulos reais do rail estão em `nav-items.ts` — `title: 'Clientes'`, `shortTitle: 'Clientes'`. Não existe "Clientes & Retenção" em nenhuma linha do arquivo. Quem lê a aba Plano procura no rail um item que não está lá.
- **Conserto proposto:** Migration trocando o nome para "Clientes", terminando com `delete from insights.achado_cache where chave like 'visao-geral|%'` (a ação vai serializada no cache). Vale varrer os outros `gabarito_acao` pelo mesmo padrão — nome de módulo escrito à mão dentro do gabarito não tem nada que o mantenha em dia quando o rail muda.

---

## clientes — 12 achados (2 de risco alto)

### Risco alto · O card "Momento aha" promete uma guarda de rastreio que a RPC não tem — e 87,9% da coluna "Não fizeram" é gente para quem a ação nem existia

- **Onde:** `src/features/clientes/clientes-page.tsx:593 (description do card-aha) · banco: public.bi_aha_moment`
- **Categoria:** regua-nao-declarada
- **Evidência:** A description (linha 593) afirma: "só ações com tracking cobrindo todo o período aparecem". Li pg_get_functiondef(public.bi_aha_moment): a única filtragem é `tipos as (select distinct tipo from acoes7)` mais `having count(*) filter (where a.user_id is not null) >= 50`. NÃO existe nenhum predicado por data de início de rastreio — a frase descreve uma régua que não está no corpo.  O efeito, medido:  1) `select tipo, min(data_brt), max(data_brt) from marts.fact_evento ...` → lesson_completed começa 2025-05-13; connection_sent 2025-07-12; certificate_generated 2025-08-19; builder_solution_created 2025-10-26; **solution_started e solution_viewed só em 2026-04-13** (e solution_started PARA em 2026-06-22 — é um dos tipos que a corroboração do próprio BI classifica como quebrado).  2) A base da RPC (cohort_mes >= mai/2025 e criado_em <= data_referencia()-120) tem 8.163 clientes. Recomputando a mesma base: `count(*) filter (where entrada + 7 <= date '2026-04-13')` = **7.178 de 8.163 (87,9%)** terminaram a primeira semana antes do primeiro registro de solution_viewed/solution_started.  3) Recomputando acoes7 por safra: quem "fez" solution_viewed (241) e solution_started (152) tem `min(cohort_mes) = max(cohort_mes) = 2026-04-01` — **vem 100% de UMA safra**. O grupo "não fizeram" que a tabela imprime ao lado (7.922 e 8.011) vai de mai/2025 a abr/2026.  Ou seja: a tela publica "Soluções visualizadas · 241 fizeram · 26,6% · 7.922 não fizeram · 17,4% · lift 1,52×" como se fossem dois grupos comparáveis da mesma safra, e são uma safra contra dezesseis. A mesma tela, duas seções acima, mostra na grade de cohort que ret_90d vai de 8,3% (set/25) a 18,1% (abr/26) — 2,2× de spread só por safra, maior que o lift publicado.
- **Conserto proposto:** Duas saídas, e a description tem de bater com a escolhida. (a) Implementar a guarda prometida: uma CTE com `min(data_brt)` por tipo e filtrar `tipos` para os que registram desde o início da base — ou restringir a base, por tipo, a quem entrou depois do primeiro registro daquele tipo (é o que torna "fizeram" e "não fizeram" comparáveis). (b) Se a guarda não for implementada agora, apagar a frase "só ações com tracking cobrindo todo o período aparecem" e pôr no lugar a régua verdadeira, com a coluna `medido_desde` visível na tabela, como já existe no card de churn. Em qualquer caso, solution_started não deveria aparecer: a corroboração do BI já o marca como quebrado.

### Risco alto · O headline "34,1 pp de gap no maior (Consultor)" é artefato da idade do módulo — e o `medido_desde` que a tela imprime na linha não filtra nada

- **Onde:** `src/features/clientes/clientes-page.tsx:471-472 (headline/headlineLabel) e 515-517 ("medido desde") · banco: public.bi_churn_modulos`
- **Categoria:** numero-errado
- **Evidência:** pg_get_functiondef(public.bi_churn_modulos): a lista `modulos` é um `values` com pares (modulo, medido_desde) e **medido_desde só aparece no SELECT** — nunca entra em predicado. A população dos dois grupos é `grupos`, que é todo cliente com qualquer evento, independentemente de o módulo já existir na vida dele.  A tela, porém, imprime embaixo do nome do módulo "medido desde 11/05/2026 (lançamento do produto)" (linhas 515-517), o que faz o leitor concluir que a conta respeita essa data.  Medido: - `select * from public.bi_churn_modulos(null,null)` → Consultor: pct_churned_nunca_usou 0,9294 · pct_ativos_nunca_usou 0,5889 · **gap_pp 34,1** (é o `piorGap` que vira o headline). - Dos 4.419 churned, **2.473 (56,0%)** tiveram a última ação ANTES de 11/05/2026 — não podiam ter usado o Consultor. (`count(*) filter (where g.churned and g.ultima < date '2026-05-11')` sobre a mesma CTE `grupos`.) - Recomputando os dois grupos restritos a quem esteve vivo a partir de 11/05/2026: churned nunca usou cai de **93,0% → 84,0%**, ativos ficam em 58,9%, e o **gap cai de 34,1 pp para 25,1 pp** (n_churned elegíveis = 1.946). Nove pontos do headline, 26% da magnitude, são a idade do módulo.  O projeto já sabe que isso importa e trata em outro lugar: insights.calcular_achados_clientes exige `c.medido_desde <= public.bi_data_referencia() - 180` para eleger módulo na regra de mortalidade. O card que o CEO lê não tem guarda nenhuma.
- **Conserto proposto:** Aplicar `medido_desde` de verdade na RPC: restringir cada coluna do par ao subconjunto de `grupos` cuja última atividade é posterior a `m.medido_desde` (ou, mais simples e mais forte, excluir do conjunto elegível o módulo cujo `medido_desde` seja mais recente que data_referencia()-180, que é o mesmo limiar que o motor já usa). Enquanto não for aplicado, o card não pode imprimir "medido desde <data>" ao lado de um número que ignora a data — ou tira a coluna, ou tira o gap dos módulos jovens do headline.

### Atenção · "Clientes em risco" diz "14+ dias em silêncio" e a RPC corta em 74 dias — ficam de fora 3.650 pessoas, mais do que as 3.624 que entram

- **Onde:** `src/features/clientes/clientes-page.tsx:397 (prosa da seção) e 406 (description) · banco: public.bi_clientes_em_risco`
- **Categoria:** regua-nao-declarada
- **Evidência:** description (linha 406): "Inatividade: era ativo e está 14+ dias em silêncio". pg_get_functiondef(public.bi_clientes_em_risco), CTE `inatividade`: `and l.ultima < h.d - 14 and l.ultima >= h.d - 74`. Existe um teto de 74 dias que a tela não menciona em lugar nenhum.  Medido com a mesma régua da RPC (dim_usuario e_cliente × max(data_brt) de fact_evento): - dentro da janela 14–74 dias: **3.624** - com 75+ dias de silêncio, silenciosamente excluídos: **3.650** - total com 14+ dias, que é o que a frase promete: **7.274**  A prosa da seção (linha 397) ainda aponta para o corte errado: "A lista vem cortada no limite da fonte, então a contagem do topo é o tamanho da lista, não o tamanho do problema". O limite da fonte é LIMITE_LISTA = 5.000 e a lista tem 3.629 linhas, então `cortada = linhas.length >= limiteDaFonte` é false e a TabelaLonga nem chega a exibir o aviso de corte. O único corte que morde hoje é o de 74 dias, e é justamente o que ninguém declara.
- **Conserto proposto:** Trocar "está 14+ dias em silêncio" por "está entre 14 e 74 dias em silêncio — quem passou de 74 já conta como churn e sai da lista de recuperação" (é o que a régua de 60 dias de churn implica, e o comentário da seção já tenta dizer com "não autópsia de quem já foi"). E rever a frase "a lista vem cortada no limite da fonte": ela afirma um corte que hoje não acontece; o `limiteDaFonte` da TabelaLonga já anuncia sozinho quando de fato morder.

### Atenção · O headline 58,0% de "Frequência de uso" não sai de nenhuma barra do gráfico que o card desenha, e o achado ancorado nele publica 42,0%

- **Onde:** `src/features/clientes/clientes-page.tsx:127 e 343-364 (card-frequencia) · banco: public.bi_dias_ativos_distribuicao`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** headline = `engajamento.data.pct_mais_de_um_dia` (linhas 127 e 346) = 0,5800 → "58,0% ativos em mais de um dia". O gráfico do card é bi_dias_ativos_distribuicao, cujo menor balde é "1–2 dias".  Rodado: `select * from public.bi_dias_ativos_distribuicao(30,null,null)` → 1–2 dias 2.340 · 3–5 886 · 6–10 375 · 11–20 97 · 21+ 4 (total 3.702). Recomputando a mesma CTE: exatamente 1 dia = **1.555**, exatamente 2 dias = **785**, mais de um dia = 2.147 → 2.147/3.702 = **0,5800**. O que as barras permitem calcular é 1 − 2.340/3.702 = **0,3679 (36,8%)**. Não há combinação de barras que dê 58,0%: a única barra que separaria 1 de 2 dias está fundida.  Pior: insights.regra `cli_frequencia` tem ancora_id = `card-frequencia` e gabarito "{pct_um_dia:pct} dos {mau:int} clientes ativos no período apareceram em um único dia", com parametros `{"pct_um_dia":0.42,"mau":3702}` (rodado em insights.calcular_achados_clientes(30,null,null)). Quem clica em "ver o gráfico que sustenta" cai num card onde 42,0% não aparece e a barra de 1.555 não existe.  O CLAUDE.md descreve exatamente esta falha ao justificar o canal `nota` do CategoryBarChart: "sem esse canal o texto publica um número que o gráfico ancorado não mostra, e quem clicou para conferir não encontra o que veio conferir".
- **Conserto proposto:** Quebrar o primeiro balde em "1 dia" e "2 dias" na RPC (é uma linha no CASE, e os totais não mudam): aí 1.555 vira barra, 42,0% e 58,0% saem do desenho e o achado ancorado passa a ter onde pousar. Alternativa mais barata: levar a contagem de "exatamente 1 dia" como `nota` do dado do balde 1–2, já formatada. Não mexer no headline — ele está certo; o que falta é o gráfico mostrar de onde ele vem.

### Atenção · Dois números chumbados na descrição do card "Quem compra retém" divergem do banco

- **Onde:** `src/features/clientes/clientes-page.tsx:245`
- **Categoria:** numero-errado
- **Evidência:** description do card-comprador (linha 245) afirma, em texto fixo: "445 membros do Club também são donos de organização" e "Como 91% dos clientes estão dentro de alguma organização".  Rodado em marts.dim_usuario: - `count(*) filter (where e_cliente and papel='membro_club' and is_master)` = **440** (e 440 também sem o filtro e_cliente) — a tela diz 445. - `count(*) filter (where e_cliente and organization_id is not null)` = 14.297 de 15.045 clientes → **95,03%** — a tela diz 91%. Pela coluna `organizacao` (texto) dá o mesmo 95,03%.  São números de contexto, mas são números impressos na tela, e um deles está 4 pontos percentuais fora.
- **Conserto proposto:** Ou tirar os dígitos da prosa e deixar a afirmação qualitativa ("parte dos membros do Club também é dona de organização", "a quase totalidade dos clientes está dentro de uma organização"), ou — melhor — fazer os dois virarem dado servido, como já é a regra do motor ("zero dígito no gabarito; a régua viaja em parametros emitido pela mesma função que calcula"). Número chumbado em prosa de UI envelhece sem ninguém ver.

### Atenção · "Quem usou Soluções" tem duas definições em duas seções da mesma tela, e uma delas está impressa na barra

- **Onde:** `src/features/clientes/clientes-page.tsx:331 (rótulo com 5.811) e 496-534 (tabela de churn) · banco: public.bi_mortalidade_modulo × public.bi_churn_modulos`
- **Categoria:** numero-errado
- **Evidência:** bi_mortalidade_modulo, CTE `usou`: só `marts.modulo_do_evento(tipo)` sobre fact_evento. bi_churn_modulos, CTE `usou`: o mesmo **`union`** `select distinct p.user_id, 'Soluções' from marts.fact_progresso_solucao p`.  Rodado sobre a base e_cliente: - por evento: **5.811** clientes - por progresso: 6.880 - união (o que o card de churn usa): **7.453** — 28% maior  O 5.811 não fica escondido: a tela imprime `Soluções (5.811)` como rótulo da barra em "Onde a jornada termina" (linha 331). Duas seções abaixo, a linha "Soluções" da autópsia de churn é calculada sobre 7.453. Mesma palavra, duas populações, sem declaração em nenhum dos dois cards.  O desencontro já está admitido em comentário dentro de insights.calcular_achados_clientes ("As duas RPCs também discordam sobre quem 'usou Soluções'; daqui só sai medido_desde") — ou seja, é conhecido no banco e invisível na tela.
- **Conserto proposto:** Escolher uma definição de "usou Soluções" e aplicá-la nas duas RPCs — progresso é o fato e evento é o aviso do fato, que é exatamente o critério que a migration 20260819160000 usou para trocar aulas de fact_evento para fact_progresso_aula. Se a diferença for para ficar, ela precisa estar na description dos dois cards, não só num comentário de função.

### Atenção · A descrição de "Onde a jornada termina" é changelog, e a régua que deveria estar ali não está

- **Onde:** `src/features/clientes/clientes-page.tsx:318`
- **Categoria:** outro
- **Evidência:** description do card-mortalidade (linha 318), literal: "A versão anterior deste card contava clientes e publicava \"59% param em Formações\" — o que mede popularidade do módulo, porque o mais usado tende a ser o último de qualquer jornada. Dividido pela audiência de cada um, a ordem muda: módulo com muita gente e pouca mortalidade é o que segura."  CLAUDE.md, seção "Regras de módulo": "**Descrição de card é RÉGUA, não changelog.** ... 'A versão anterior deste card fazia X' é conversa com o revisor: vive no commit e no doc, nunca na tela." São ~230 dos 480 caracteres da descrição falando com o revisor.  E o que falta é justamente régua. Lendo pg_get_functiondef(public.bi_mortalidade_modulo): `churned as (select v.* from vida v, hoje h where v.ultima < h.d - 60)` e `case when count(distinct u.user_id) >= 30 then ... end`. Nem os 60 dias que definem "sumir", nem a supressão abaixo de 30 na audiência estão na tela — e o card vizinho, duas seções à frente, declara os 60 dias, o que deixa a mesma régua declarada num lugar e omitida no outro.
- **Conserto proposto:** Trocar o parágrafo de changelog pela régua: "De quem passou por cada módulo, que fatia teve ali a última ação antes de sumir · sumir = 60+ dias sem nenhuma ação · taxa sobre a audiência histórica do módulo, suprimida abaixo de 30 · base histórica inteira, não responde ao período do topo". O contraste com a versão anterior vive no commit.

### Observação · Módulos descontinuados (Comunidade e Networking) aparecem em dois cards, e o achado manda o leitor para a lista onde eles estão

- **Onde:** `src/features/clientes/clientes-page.tsx:325-337 (chart de mortalidade) e 496-534 (tabela de churn) · banco: public.bi_mortalidade_modulo, public.bi_churn_modulos`
- **Categoria:** outro
- **Evidência:** marts.modulos_descontinuados() = `array['Comunidade','Networking']` (rodado). Nenhuma das duas RPCs da tela a consulta: bi_mortalidade_modulo deriva os módulos de marts.modulo_do_evento e bi_churn_modulos tem uma lista VALUES chumbada com as duas dentro.  Rodado: - bi_mortalidade_modulo(null,null) → 7 barras, entre elas Comunidade (81 usaram, 17,3%) e Networking (292 usaram, 13,7%). Mentoria entra com 32 usaram e taxa 0,0%. - bi_churn_modulos(null,null) → 7 linhas, entre elas Comunidade (gap −0,1) e Networking (gap −0,9).  E o gabarito de insights.regra `cli_mortalidade` termina em "As taxas dos demais módulos estão em Onde a jornada termina" — mandando o leitor para uma lista em que 2 de 7 destinos não existem mais no produto.
- **Conserto proposto:** Nos dois cards, ou excluir `= any(marts.modulos_descontinuados())` do desenho (mantendo o histórico nos fatos, como o CLAUDE.md exige), ou marcar as linhas com StatusPill "Descontinuado". A primeira é a que casa com o motivo pelo qual a função existe: "card que dá alarme falso todo dia ensina a ignorar o card".

### Observação · A lista de risco tem uma pessoa duas vezes: 3.629 linhas para 3.628 e-mails, e duas chaves React iguais

- **Onde:** `src/features/clientes/clientes-page.tsx:404 (headline) e 415 (chave) · banco: public.bi_clientes_em_risco`
- **Categoria:** numero-errado
- **Evidência:** bi_clientes_em_risco faz `select * from (select * from vencimento union all select * from inatividade)` — `union all`, sem dedup. As duas condições não são exclusivas: `vencimento` exige `l.ultima < h.d - 7` e `inatividade` exige `h.d - 74 <= l.ultima < h.d - 14`, então quem tem plano vencendo E está 14–74 dias parado sai duas vezes.  Rodado com os argumentos da página (p_limite = LIMITE_LISTA = 5000): - linhas 3.629 · emails distintos **3.628** · plano_vencendo 5 · inatividade 3.624 - `group by email having count(*) > 1` → **gabriela@webpesados.com.br, n=2, motivos: plano_vencendo + inatividade**  Consequências: o headline `formatInt(risco.data.length)` = "3.629 clientes na lista" conta uma pessoa duas vezes, e a TabelaLonga renderiza `<Fragment key={chave(linha)}>` com `chave={(r) => String(r.email)}` (linha 415) — duas chaves iguais na mesma lista.
- **Conserto proposto:** Resolver no banco, que é onde a régua mora: dar precedência a plano_vencendo (que já é o primeiro do ORDER BY) e excluir do CTE `inatividade` quem já saiu por vencimento — `where not exists (select 1 from vencimento v where v.email = u.email)` — ou trocar o `union all` por `distinct on (email)` respeitando a mesma ordem. Hoje é uma pessoa; com mais planos vencendo o número cresce em silêncio.

### Observação · O KPI "Usam 2+ módulos" e o headline do card "Amplitude de uso" são o mesmo número, com duas redações

- **Onde:** `src/features/clientes/clientes-page.tsx:192-199 (KPI) e 367-391 (card de amplitude)`
- **Categoria:** densidade-ou-ordem
- **Evidência:** Linha 194: `value={engajamento.data?.pct_multimodulo}` com label "Usam 2+ módulos". Linha 128 e 372: `multiModulo = engajamento.data?.pct_multimodulo` vira o headline do card "Amplitude de uso", com headlineLabel "usam mais de um módulo".  É a mesma leitura da mesma RPC: `select * from public.bi_engajamento_clientes(30,null,null)` → pct_multimodulo 0,4325 → **43,3% nos dois lugares**. Não há risco de divergência (é a mesma fonte, ao contrário dos casos que a migration 20260819160000 fechou), mas um dos quatro slots de KPI da dobra gasta-se repetindo um card que está três seções abaixo — e o card de amplitude é o único dos dois que mostra de onde o número vem (2.101+1.013+461+127 = 3.702, e 1.601/3.702 = 43,2%).
- **Conserto proposto:** Trocar o quarto KPI por um número que nenhum card publica — a fileira já tem stickiness, hábito e dias ativos médios; a taxa de churn (bi_churn_resumo.pct_churn = 45,3%) hoje só existe dentro de um popover e é o número maior da tela. Ou manter o KPI e tirar o headline duplicado do card de amplitude, deixando ali outra pergunta.

### Observação · "Stickiness (DAU/MAU)" é o único rótulo em inglês da tela e não tem definição em lugar nenhum

- **Onde:** `src/features/clientes/clientes-page.tsx:168-175`
- **Categoria:** outro
- **Evidência:** Linha 169: `label="Stickiness (DAU/MAU)"`. Li src/components/charts/kpi-card.tsx: a props do KpiCard tem `label: string` e nada mais de texto — não existe `description`/Popover como no CardCabecalho (linhas 43, 128, 158, 174, 195). Então o termo fica sem glossário: quem não sabe o que é DAU/MAU não tem onde descobrir na tela.  CLAUDE.md, Regras de trabalho: "Texto de UI sempre em pt-BR". Os outros três KPIs da mesma fileira estão em pt-BR ("Hábito semanal", "Dias ativos por cliente", "Usam 2+ módulos").  O valor em si está correto: bi_engajamento_clientes devolve stickiness 0,0951 = avg(dau)/mau = 352,0/3.702, com supressão em count(por_usuario) >= 30 e o motivoSemValor apontando para `mau`, que é o denominador certo.
- **Conserto proposto:** Rotular em pt-BR o que a métrica responde — "Volta no mesmo mês" ou "Dias ativos / clientes do mês" — mantendo (DAU/MAU) entre parênteses se o time usa o termo. Se a definição precisar caber na tela, o caminho é dar ao KpiCard o mesmo botão circular de informação do CardCabecalho, e aí é peça de kit, não de página.

### Observação · A tela está exatamente no teto da catraca e reprovaria a régua absoluta em quatro das cinco medidas — dívida declarada no CLAUDE.md, mas sem exceção escrita no fonte

- **Onde:** `src/features/clientes/clientes-page.tsx (arquivo inteiro) · src/lib/densidade.ts:206-240`
- **Categoria:** densidade-ou-ordem
- **Evidência:** Medido no próprio arquivo: **10** cards de conteúdo (6 ChartCard + 4 TabelaCard), **6** SecaoDeAnalise, **17** `<TableHead>`, e as 6 descrições de seção com 300, 356, 319, 279, 363 e 346 caracteres.  Contra REGUA_DE_DENSIDADE: cardsDeConteudoNoMaximo 9 → 10 reprova · secoesNoMaximo 5 → 6 reprova · cardsPorSecaoNoMinimo 2 → 3 seções com um card só (cohort, risco, aha) reprova · prosaDeSecaoNoMaximo 240 → as 6 reprovam (maior 363). descritivosNoMinimo 1 → 2, passa.  As duas REGRAS_DE_ORDEM passam: o pico da 1ª seção é `comparativo` (não descritivo), e o único prescritivo está na 4ª de 6 seções, não na última.  TETO_POR_TELA['features/clientes/clientes-page.tsx'] = { cards: 10, colunas: 17 } — a tela está no limite exato dos dois eixos, então qualquer card ou coluna nova quebra o teste. A escada passa (2 descritivos, 3 comparativos, 4 diagnósticos, 1 prescritivo) e clientes está em TELAS_NA_REGUA (src/lib/escada.test.ts:33), mas NÃO está em TELAS_NA_DENSIDADE — é a dívida que o CLAUDE.md declara ("7 das 10 telas em 19/ago; faltam clientes, CS e receita"). Não há marca `DENSIDADE_DECLARADA:` no fonte.
- **Conserto proposto:** Nada a fazer sem decisão do Mateus — é a fase de densidade que ainda não chegou nesta tela. Registrando os alvos para quando chegar: as candidatas naturais a fusão são a seção 1 (cohort, sozinha) com a seção 2 ("quem fica"), que respondem a mesma pergunta de retenção, e a seção 6 (aha, sozinha) com a seção 5 ("o que quem saiu deixou de usar"), que já testam a mesma hipótese por caminhos opostos — isso levaria 6 seções a 4 e resolveria duas das três órfãs. As 6 prosas precisam cair para 240, e o CLAUDE.md avisa que encurtar prosa APAGA RÉGUA: as cláusulas "não responde ao seletor de período" da seção 3 e "responde só ao filtro de plano" da seção 2 precisam de destino (description do card) antes de sair.

---

## entrada — 9 achados (2 de risco alto)

### Risco alto · O card "Onde os incompletos param" publica 1.597 como número de clientes — 545 deles não são clientes

- **Onde:** `src/features/entrada/entrada-page.tsx:82-85, 389-390 · public.bi_onboarding_abandono`
- **Categoria:** numero-errado
- **Evidência:** pg_get_functiondef de public.bi_onboarding_abandono: `select o.step_atual, count(*) from marts.fact_onboarding o where not o.concluido and o.step_atual is not null group by 1` — NENHUM join com marts.dim_usuario, nenhuma régua e_cliente. SQL rodado: `select o.step_atual, count(*) publicado, count(*) filter (where u.e_cliente) com_regua from marts.fact_onboarding o left join marts.dim_usuario u on u.user_id=o.user_id where not o.concluido and o.step_atual is not null group by 1` devolveu: etapa 0 → 1.182 publicado / 747 com régua (435 fora, 36,8% da barra); etapa 1 → 299/216; etapa 2 → 35/25; etapa 3 → 68/51; etapa 4 → 10/10; etapa 5 → 3/3. TOTAL: 1.597 publicado × 1.052 com a régua = 545 não-clientes (34,1% do headline). O `comment on function` DECLARA a exceção, mas condiciona a justificativa a um card que não existe mais: "A fatia se sustenta porque numerador e denominador carregam a mesma contaminação, e é fatia que o card e a regra publicam" — e a linha anterior do mesmo comentário diz "o número ABSOLUTO de incompletos é maior que a base de clientes". O card hoje publica exatamente o absoluto (`headline={formatInt(incompletos)}` + "não concluíram o onboarding"). E a fatia também não é estável: 1.182/1.597 = 74,0% publicado × 747/1.052 = 71,0% com a régua (3 pp). A regra `ent_onboarding_nao_comeca` (score 1,48, dentro do corte de 3) publica "1.182 dos 1.597 CLIENTES com onboarding em aberto" — a palavra é clientes e 545 não são.
- **Conserto proposto:** Duas saídas, e as duas exigem migration. (a) Aplicar a régua: `join marts.dim_usuario u on u.user_id=o.user_id and u.e_cliente` na RPC, reescrever o `comment on function` e purgar `insights.achado_cache where chave like 'entrada|%'` (a fatia muda de 74,0% para 71,0%). (b) Se a exceção for para ficar, o card volta a publicar SÓ fatia (74,0% na primeira etapa), o headline deixa de ser absoluto, e a descrição passa a dizer que o eixo conta registros de onboarding e não clientes. A opção (a) é a que o resto da tela já usa — bi_entrada_kpis, bi_funil_entrada, bi_entrada_efeito_onboarding e bi_entrada_primeira_acao_por_origem todos filtram.

### Risco alto · O mesmo card publica headline "0" enquanto carrega e no estado de erro

- **Onde:** `src/features/entrada/entrada-page.tsx:82-85, 389`
- **Categoria:** numero-errado
- **Evidência:** `const incompletos = useMemo(() => (onboarding.data ?? []).reduce((soma, o) => soma + o.clientes, 0), [onboarding.data])` (linhas 82-85) e `headline={formatInt(incompletos)}` com `headlineLabel="não concluíram o onboarding"` (389-390). Com `onboarding.data` undefined o reduce devolve 0. E o headline NÃO está protegido pelo esqueleto: em src/components/charts/chart-card.tsx o `<CardCabecalho {...cabecalho} />` está na linha 68, FORA do ternário `isLoading ? <Skeleton…> : isError ? <erro> : …` que começa na linha 74. A tela publica, em toda carga e permanentemente sob erro, "0 não concluíram o onboarding". Este é o defeito que `contrato-de-tela.test.ts` já persegue no bloco "headline não conta uma lista que ainda não chegou" ("O esqueleto do card cobre o corpo, não o headline") — a regex casa `headline={… ?? []).length}` e o `reduce` escapa. Os outros cinco headlines da tela fazem certo (`chegamNaPrimeiraAcao != null ? … : '—'`, `convitesNunca?.pct != null ? … : '—'`, etc.); só este não.
- **Conserto proposto:** `const incompletos = onboarding.data ? onboarding.data.reduce((s,o)=>s+o.clientes,0) : null` e `headline={incompletos != null ? formatInt(incompletos) : '—'}`, no mesmo padrão dos outros cinco cards. E alargar a regex do `contrato-de-tela.test.ts` para pegar a classe (`headline` que consome `?? []`), não só a grafia `.length` — é a mesma lição do `value={} × value:` registrada no próprio arquivo.

### Atenção · A descrição do card publica 89,5% e 92,5% — dois números que nenhuma RPC da tela devolve, dentro de um changelog

- **Onde:** `src/features/entrada/entrada-page.tsx:391`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** Literal em entrada-page.tsx:391: `description="Distribuição por etapa atual de quem não concluiu · o número que estava aqui era escrito à mão e estava errado (dizia 89,5% quando a régua e_cliente dá 92,5%); percentual só entra vindo do banco"`. Rodei as oito RPCs da tela com os argumentos da página: nenhuma devolve 89,5% nem 92,5%. O único percentual próximo é o KPI `onboarding_pct` = 89,81% (de bi_entrada_kpis(30)), que é outra métrica (dos cadastrados na janela). E os dois dígitos estão defasados: `select round(count(*) filter (where o.concluido)::numeric/count(*),4), round(count(*) filter (where o.concluido and u.e_cliente)::numeric/nullif(count(*) filter (where u.e_cliente),0),4) from marts.fact_onboarding o left join marts.dim_usuario u on u.user_id=o.user_id` devolve hoje 0,9005 e 0,9301 — ou seja 90,1% e 93,0%, não 89,5% e 92,5%. Além disso viola a regra da casa: "Descrição de card é RÉGUA, não changelog. 'A versão anterior deste card fazia X' é conversa com o revisor: vive no commit e no doc, nunca na tela". E o texto afirma uma régua e_cliente que a RPC declaradamente NÃO aplica.
- **Conserto proposto:** Trocar por régua pura, em uma ou duas linhas: o que conta (registros de onboarding em aberto), a foto (sem janela, estado de hoje), e a armadilha real (o eixo é o índice de etapa da plataforma; etapa 6 = concluído, por isso não aparece). O parêntese com os dois percentuais sai inteiro — a história vive no commit 5add993.

### Atenção · A AbaDeDados descreve uma coluna "erros" que a RPC não devolve mais

- **Onde:** `src/features/entrada/entrada-page.tsx:419`
- **Categoria:** codigo-morto
- **Evidência:** entrada-page.tsx:419: `descricao: \`uma linha só — convites, conversão, onboarding e erros dos últimos ${periodo} dias\``. A assinatura atual é `bi_entrada_kpis(p_dias integer) RETURNS TABLE(convites bigint, conversao numeric, onboarding_pct numeric, primeira_acao bigint)` — não há coluna de erro. O `comment on function` confirma: "Substituiu `erros_login`, telemetria de engenharia que saiu da tela por decisao do Mateus em 19/08/2026". `git show c8723f4` mostra que essa string nasceu quando o 4º KPI ainda era `erros_login`, e o commit de hoje (b2721b9) trocou o KPI e o comentário da página mas não este texto. Grep confirma que é a única ocorrência de "erro" sobrevivente em src/features/entrada/.
- **Conserto proposto:** `uma linha só — convites, conversão, onboarding e quem chegou à 1ª ação nos últimos ${periodo} dias`.

### Atenção · Quatro `?? 0` em valor exibido, todos fora do alcance do teste de contrato

- **Onde:** `src/features/entrada/entrada-page.tsx:233, 239, 308, 311`
- **Categoria:** numero-errado
- **Evidência:** Grep `?? 0` em entrada-page.tsx devolve 4 ocorrências, nenhuma coberta pelo CI. Linha 233: `formatPercent(mastersResumo.data.pct_convidam ?? 0)` — é o HEADLINE do card "Masters × convites". Linha 239: `formatPercent(mastersResumo.data.conversao_convites ?? 0)` na descrição. Linhas 308 e 311: `formatInt(nuncaAgiu?.base_comprador ?? 0)` e `formatInt(nuncaAgiu?.base_convidado ?? 0)`, que são os DENOMINADORES impressos nos dois `<TableHead>` da tabela comprador × convidado. O `contrato-de-tela.test.ts` (linhas 62-65) casa apenas `/value=\{[^}]*\?\?\s*0\s*[})]/` e `/value:\s*[^,}]*\?\?\s*0\s*[,}]/` — as quatro formas acima passam. No banco os campos são nuláveis de propósito: `pct_convidam` e `conversao_convites` vêm de `nullif(...,0)` em bi_masters_convites_resumo, e as bases de origem só existem se a faixa 'Nunca agiu' vier na resposta (a RPC só emite faixa com pelo menos uma linha). Rodei bi_entrada_primeira_acao_por_origem() e a faixa veio, com base_comprador=1.100 e base_convidado=8.005; mas o dia em que ela não vier, os dois cabeçalhos publicam "Comprador (0)" e "Convidado (0)" com o corpo cheio de percentuais.
- **Conserto proposto:** Nos quatro casos, `x != null ? format(x) : '—'`. Para as bases, tirar a dependência da linha 'Nunca agiu': elas são constantes em todas as linhas, então `origem.data?.[0]?.base_comprador` é mais honesto que pescar numa faixa específica. E alargar a regex do contrato para casar `formatPercent(… ?? 0)` / `formatInt(… ?? 0)`, não só `value`.

### Atenção · O eixo do gráfico rotula "Etapa 0"…"Etapa 5" — índice técnico cru, e o texto da Análise chama o mesmo balde de "primeira etapa"

- **Onde:** `src/features/entrada/entrada-page.tsx:400-403`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** entrada-page.tsx:400-403: `category: \`Etapa ${o.step_atual}\``, direto do inteiro do banco. `select step_atual, count(*) from marts.fact_onboarding group by 1` devolve 0→1.182, 1→305, 2→65, 3→68, 4→10, 5→16, 6→14.411: o 6 é "concluído" e o 0 é "não começou", nenhum dos dois é uma etapa do formulário. A maior barra do card (74,0% do total) é rotulada "Etapa 0". Enquanto isso, a regra `ent_onboarding_nao_comeca` — que ancora em `ancora_id='card-onboarding-abandono'`, ou seja, o link "Ver o gráfico que sustenta" leva exatamente a este card — publica "{na_primeira} dos {incompletos} clientes … estão parados na PRIMEIRA ETAPA". Quem clica para conferir encontra "Etapa 0", não "primeira etapa". Os nomes existem na origem (`plataforma.onboarding_step_tracking.step_name`), mas a tabela está VAZIA (`select step_number, step_name, count(*) … group by 1,2` devolveu zero linha), então a tradução tem de ser um mapa declarado, não um join.
- **Conserto proposto:** Mapa de rótulos em pt-BR no fonte (ou na própria RPC), com o 0 nomeado pelo que ele é — "Não começou" — e as etapas 1-5 com o nome do bloco correspondente (`onboarding_final` tem os jsonb: personal_info, professional_info, business_info, ai_experience, goals_info). Com o 0 nomeado, o gabarito da regra deixa de ter que chamá-lo de "primeira etapa", que é o que hoje faz o texto e o gráfico discordarem.

### Atenção · A aba Plano manda o leitor para "a aba Funil" e para um card que mudou de nome — as duas referências estão mortas

- **Onde:** `insights.regra id='ent_onboarding_nao_comeca' (gabarito_acao) · src/features/entrada/entrada-page.tsx:291`
- **Categoria:** outro
- **Evidência:** `select gabarito_acao from insights.regra where id='ent_onboarding_nao_comeca'` devolve: "…Quem passa dali e mesmo assim não age aparece em Tempo até a 1ª ação, na aba Funil." As abas de todo módulo são `graficos` · `analise` · `plano` desde 18/ago (nav-items.ts:219-223 para /entrada); a aba `funil` foi removida no commit c8723f4, que renomeou `funil:` para `graficos:` neste mesmo arquivo. E o card não se chama mais "Tempo até a 1ª ação": o título atual é "Quem comprou age; quem foi convidado, não" (entrada-page.tsx:291). Esta regra está DENTRO do corte (score 1,48, 3ª de 4), então o texto é publicado nas abas Análise e Plano da Entrada hoje.
- **Conserto proposto:** Migration reescrevendo `gabarito_acao` para apontar o card pelo nome atual e sem citar aba que não existe ("…aparece no card 'Quem comprou age; quem foi convidado, não', nesta mesma tela", no padrão que `ent_sem_primeira_acao` e `ent_master_nao_convida` já usam). Terminar a migration com `delete from insights.achado_cache where chave like 'entrada|%'` — o cache guarda o achado serializado e serviria o texto antigo sem erro nenhum.

### Observação · O card "Masters × convites" não tem estado de carregamento nem de erro para a metade dele que vem da outra RPC

- **Onde:** `src/features/entrada/entrada-page.tsx:242-245`
- **Categoria:** outro
- **Evidência:** entrada-page.tsx:242-245 liga `isLoading`, `isRefreshing`, `isError` e `onRetry` apenas a `mastersTop` (bi_masters_top_convidadores). Mas o headline (linha 231-236) e a descrição (237-241) saem de `mastersResumo` (bi_masters_convites_resumo). Conferi que os dois números batem — `select count(*) from bi_masters_top_convidadores(5000)` devolve 1.167, que é exatamente o `masters_convidaram` de bi_masters_convites_resumo(), e 1.167/2.097 = 0,5565 = o headline 55,7%; a composição é legítima. O problema é só o estado: se `bi_masters_convites_resumo` falhar, o card renderiza normal, com headline '—' e a descrição de fallback "Quem traz gente para dentro — histórico completo", sem nenhum sinal de erro e sem botão de tentar de novo.
- **Conserto proposto:** `isLoading={mastersTop.isLoading || mastersResumo.isLoading}`, `isError={mastersTop.isError || mastersResumo.isError}`, `isRefreshing={(mastersTop.isFetching && !!mastersTop.data) || (mastersResumo.isFetching && !!mastersResumo.data)}` e `onRetry` disparando as duas.

### Observação · A dívida da escada está registrada sobre uma premissa que a medição desmente

- **Onde:** `src/lib/escada.test.ts:42-45`
- **Categoria:** codigo-morto
- **Evidência:** src/lib/escada.test.ts:42-45 justifica a saída da Entrada da régua dizendo: "O achado `ent_master_nao_convida` (compradores que nunca convidaram) existe no motor e APARECE NAS ABAS ANÁLISE E PLANO — falta o CARD que o sustente". Rodei `select regra, familia, severidade, suprimida, score from public.bi_achados_entrada(30)`: ent_sem_primeira_acao 1,69 · ent_perda_antes_da_conta 1,56 · ent_onboarding_nao_comeca 1,48 · ent_master_nao_convida 1,33 — quatro famílias distintas, nenhuma suprimida. E `selecionar()` em src/features/resumo/selecao.ts:31 faz `if (visiveis.length >= MAXIMO_DE_ACHADOS) break` com `MAXIMO_DE_ACHADOS = 3`. O 4º é cortado: `ent_master_nao_convida` NÃO aparece em nenhuma das duas abas hoje — ele cai em `abaixoDoCorte`.
- **Conserto proposto:** Corrigir o comentário: o achado existe no motor mas está abaixo do corte de 3 (score 1,33 contra 1,48 do terceiro colocado). O caminho de volta para a régua é o mesmo — criar o card prescritivo dos compradores sem convite — mas ele não pode ser descrito como "já visível nas abas, só falta o card", porque a única forma de o leitor ver esse achado hoje é o /plano transversal.

---

## formacoes — 7 achados (1 de risco alto)

### Risco alto · Só o card do catálogo conta curso publicado; os outros três contam o catálogo inteiro — e a prosa da seção afirma o contrário

- **Onde:** `src\features\formacoes\formacoes-page.tsx:168 (prosa da seção), :178 (description de "Uso por formação"), :232 (description de "Assuntos mais assistidos"), :260 (NPS), :489 (Tempo até o certificado)`
- **Categoria:** regua-nao-declarada
- **Evidência:** pg_get_functiondef: bi_formacoes_uso tem `where c.publicado`; bi_assuntos, bi_nps_cursos e bi_jornada_cursos NÃO têm filtro de publicação nenhum. Medido: soma de "Aulas (30d)" da tabela = 22.840 contra 22.889 do KPI e de bi_assuntos — 49 aulas de curso não publicado (30 em `ferramentas`, 19 em `backstage`). A barra inteira "backstage" do gráfico de Assuntos (19 aulas, 5 alunos) é 100% curso não publicado: `select categoria, count(*) filter (where publicado) from marts.dim_curso group by 1` devolve backstage = 6 cursos, 0 publicados — nenhuma dessas linhas pode aparecer na tabela ao lado. Pior nas listas: 10 das 53 formações do NPS e 9 das 54 de "Tempo até o certificado" não existem em bi_formacoes_uso(30) (Leaders AI Conference 2025, Formação de Typebot, Formação de Freepik, HotSeats do Viver de IA, Isso é Copy! Com AI, os três Backstage, Dicas e Tutoriais, Tráfego Pago com AI). A prosa da seção 1 diz literalmente: "Os dois primeiros contam a mesma aula concluída, mudando só o agrupamento — formação e categoria". Não é só o agrupamento: é outra população.
- **Conserto proposto:** Duas saídas, e a escolha é de produto. (a) Alinhar: pôr `where c.publicado` em bi_assuntos, bi_nps_cursos e bi_jornada_cursos — aí a prosa passa a ser verdade e os 22.840 batem em toda a tela. (b) Declarar: trocar a cláusula da prosa por algo como "o primeiro conta só formação publicada, o segundo conta o catálogo inteiro", pôr "· só formações publicadas" na description do card de uso e "· inclui formação não publicada" nas outras três. Sem uma das duas, três cards da mesma tela respondem sobre conjuntos diferentes sem dizer.

### Atenção · O headline do único card prescritivo aponta uma formação que não está publicada e não aparece no catálogo da própria tela

- **Onde:** `src\features\formacoes\formacoes-page.tsx:256-259`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** `piorNps` (linha 115-119) é o máximo de pct_detratores sobre bi_nps_cursos(10); rodado: max = 0,1731, curso = "Leaders AI Conference 2025". No banco: `select titulo, publicado, categoria from marts.dim_curso where titulo = 'Leaders AI Conference 2025'` → publicado = false, categoria = backstage. Ela não está entre as 48 linhas de bi_formacoes_uso(30). Some-se a isso que a TabelaLonga é servida na ordem da RPC (`order by 3 asc` = média), então a 1ª linha visível é "Claude AI (anthropic)" com 14,04% de detratores — o número do headline (17,3%) está na 2ª linha, sob outro critério de "pior". O card diz "na pior formação" sem nomear qual, e a tela manda revisar conteúdo que está fora do ar.
- **Conserto proposto:** Se a decisão do achado 1 for alinhar as RPCs, isto se fecha junto. Se não, o headlineLabel precisa nomear a formação (`de detratores em ${piorNps.curso}`) e a tabela precisa marcar linha não publicada, senão a ação do card é sobre um curso que o leitor não encontra em lugar nenhum da tela.

### Atenção · "Onde o aluno para no curso" esconde os dois cortes que decidem quem entra na curva — 19 de 58 formações

- **Onde:** `src\features\formacoes\formacoes-page.tsx:344 (description) e :569 (fonte na AbaDeDados)`
- **Categoria:** regua-nao-declarada
- **Evidência:** bi_dropoff_posicao filtra `base as (... where c.posicao = 1 and c.n >= 50)` e `where t.total >= 10`. Recomputado: 58 cursos têm conclusão, 55 passam o piso de 50, e só 19 passam os dois (13 publicados + 6 não publicados). A description do card diz apenas "Sobrevivência média por posição da aula (conclusões ÷ 1ª aula do curso) · decis da grade", e a fonte na AbaDeDados repete "conclusões ÷ 1ª aula do curso, por decil da grade". A régua existe e está escrita — no motor: `insights.regra.for_evasao_inicio.gabarito_leitura` publica 'min_aulas_grade' 10 e 'min_base' 50 ("formações com 10 aulas ou mais e pelo menos 50 alunos na primeira aula"). A aba Análise declara o recorte; o card que ela ancora, não.
- **Conserto proposto:** Acrescentar à description a mesma cláusula que o motor já usa: "· média entre as formações com 10+ aulas na grade e 50+ conclusões na 1ª aula (19 das 58 com conclusão)". É o par exato do que o card de duração ao lado já faz ("só curso E aula publicados, com 50+ conclusões").

### Atenção · A descrição do card de duração é changelog — conta o que a versão anterior mostrava

- **Onde:** `src\features\formacoes\formacoes-page.tsx:314`
- **Categoria:** outro
- **Evidência:** Linha 314, 381 caracteres, terminando em: "a queda com a duração é real mas suave, e acima de 30 min não há aula publicada suficiente para afirmar — o precipício que esta tela mostrava vinha de 76 aulas longas em cursos não publicados". O CLAUDE.md é explícito: "Descrição de card é RÉGUA, não changelog. O que conta, a janela, a exclusão, a armadilha de leitura — em uma ou duas linhas. 'A versão anterior deste card fazia X' é conversa com o revisor: vive no commit e no doc, nunca na tela." As três primeiras cláusulas são régua legítima; a última é conversa com o revisor, e os 76 são um número de uma versão que não existe mais.
- **Conserto proposto:** Cortar a partir do travessão. "Acima de 30 min não há aula publicada suficiente para afirmar" já é a armadilha de leitura e sobrevive sozinha; o resto vai para a mensagem de commit.

### Atenção · "NPS por formação" declara nivel="prescritivo" sendo um placar — e é o único prescritivo da tela

- **Onde:** `src\features\formacoes\formacoes-page.tsx:253`
- **Categoria:** nivel-desonesto
- **Evidência:** escada.ts: prescritivo responde "o que fazer, sobre quem" e exige "lista acionável, ou ação com o número que a justifica". O card é uma TabelaLonga de Formação | Respostas | Média | Detratores, com busca e paginação, ordenada por média — sem limiar, sem recorte de quem age, sem ação. Comparado com os outros sete prescritivos do produto, que todos nomeiam o conjunto a tratar: "Clientes em risco — lista para ação" (clientes:401), "Experimentaram a IA e não voltaram — lista para ação" (ia:406), "Candidatas a remoção ou revisão" (solucoes:241), "Organizações em risco — time parado" (organizacoes:233). E é carga estrutural: formacoes está em TELAS_NA_REGUA (escada.test.ts:46) e REGUA.prescritivosNoMinimo é 1 — tirar o rótulo reprova a tela no CI, que é exatamente o que aconteceu com a Entrada em 19/ago.
- **Conserto proposto:** Não trocar a etiqueta e pronto — isso só derruba a tela da régua. Fazer o card virar o que ele diz ser: recortar para as formações acima de um limiar de detratores (ex.: as 4 acima de 12%), dar título de ação ("Formações para revisar — os alunos reclamam") e pôr o corte na description. O placar completo continua disponível na AbaDeDados.

### Observação · O headline "formações com aluno no período" conta formações publicadas, não formações com aluno

- **Onde:** `src\features\formacoes\formacoes-page.tsx:176-177`
- **Categoria:** numero-errado
- **Evidência:** O headline é `uso.data.length` (linha 176) com o rótulo "formações com aluno no período". bi_formacoes_uso é `left join progresso` sobre `marts.dim_curso where c.publicado`, sem `having` — devolve TODA formação publicada, com alunos = 0 inclusive. Medido nos três períodos que o seletor oferece: p=7 → 48 linhas, 0 com alunos=0; p=30 → 48, 0; p=90 → 48, 0. E `select count(*) from marts.dim_curso where publicado` = 48. Ou seja: hoje o número está certo por coincidência (todas as 48 publicadas tiveram aluno até na janela de 7 dias). No dia em que uma formação publicada passar sete dias sem aluno, o headline continua dizendo 48 e ninguém percebe.
- **Conserto proposto:** Ou contar o que o rótulo promete — `uso.data.filter((c) => c.alunos > 0).length` — ou trocar o rótulo para "formações publicadas no catálogo", que é o que a RPC de fato devolve. A segunda opção casa melhor com o achado 1.

### Observação · Dígito escrito à mão na descrição do NPS ("média geral 9,5"), contra o próprio comentário da página

- **Onde:** `src\features\formacoes\formacoes-page.tsx:260`
- **Categoria:** numero-errado
- **Evidência:** Linha 260: "média geral 9,5 tem viés de positividade". Conferido no banco: `select round(avg(n.score),2) from marts.fact_nps_aula n join marts.dim_usuario u on u.user_id=n.user_id and u.e_cliente` = 9,47 — arredonda para 9,5, então está correto hoje. Mas o comentário da própria página (linhas 74-76) proíbe isto: "Vem do dado, nunca escrito à mão: número em texto fixo envelhece na carga seguinte e ninguém percebe, porque continua parecendo certo." Some-se que o KPI do topo da mesma tela, "NPS médio das aulas", mostra 9,24 (bi_formacoes_kpis(30), rodado) — duas médias com 0,26 de diferença na mesma tela, e só uma delas diz a janela.
- **Conserto proposto:** Tirar o dígito da frase ("a média geral tem viés de positividade — o sinal está nos detratores") ou compô-la do dado, como os dois comparativos da tela já fazem com margem_pp. Se ficar, dizer que é histórica, para não competir com o KPI de 30 dias logo acima.

---

## solucoes — 9 achados (2 de risco alto)

### Risco alto · O bloco de destaque (tone="brand") publica 37,7% calculado no front, sobre um denominador que nenhuma barra mostra — é o MESMO defeito que Organizações consertou hoje

- **Onde:** `src\features\solucoes\solucoes-page.tsx:82-88 (cálculo) e :218-220 (headline/headlineLabel/description)`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** O card "Uso por categoria" desenha `value: c.iniciadas` (contagem absoluta, eixo no zero) e o headline vem de `categoriaLider`, calculado no front:  ``` const maior = cats.reduce((a, b) => (b.iniciadas > a.iniciadas ? b : a)) const total = cats.reduce((soma, c) => soma + c.iniciadas, 0) return total > 0 ? { categoria: maior.categoria, parte: maior.iniciadas / total } : null ```  SQL rodado (`select sum(iniciadas), max(iniciadas), round(max/sum,6) from public.bi_solucoes_por_categoria()`): total_iniciadas = 49.737, lider = 18.774 (Vendas), parte = 0,377465 → o headline imprime **37,7% / "em Vendas"**. Nem 37,7% nem o denominador 49.737 existem em lugar nenhum da tela: as 8 barras são 18.774 · 10.521 · 5.549 · 5.487 · 3.728 · 2.645 · 2.008 · 1.025.  É literalmente o código que o commit 0ebc31b ("Três cards publicavam número que nenhuma barra mostra", hoje 14:57) removeu de `organizacoes-page.tsx` — `faixaLotacao` tinha as MESMAS três linhas (`reduce` do maior, `reduce` da soma, divisão) e o commit escreveu no lugar: "A fatia vem do banco (`pct_das_com_limite`), não de soma no front: contagem nunca é suprimida, e percentual derivado dela escaparia da régua de amostra." Soluções não foi tocada no commit. Agrava: o card declara `nivel="descritivo"`, cuja exigência em `escada.ts` é "denominador visível" — o denominador é justamente o que não está lá.  Conferido no banco que a lista NÃO é cortada (`bi_solucoes_por_categoria` não tem LIMIT nem HAVING), então o problema não é fatia sobre lista cortada — é fatia calculada fora do banco e ausente do desenho.
- **Conserto proposto:** Mesma saída dos três cards de hoje: a fatia sai do banco. Migration em `bi_solucoes_por_categoria` acrescentando `pct_das_iniciadas` (a própria linha sobre o total das linhas, com supressão declarada) e `iniciadas_total` como coluna de janela; a página passa a ler `categorias.data?.[0]` em vez de somar. Se a decisão for manter a fatia, ela tem de aparecer no desenho — ou o headline vira o número que as barras somam (`formatInt` do total, com `headlineLabel` "soluções iniciadas em 8 categorias"), e a fatia da líder vai pelo canal `nota` do CategoryBarChart, que existe exatamente para isso.

### Risco alto · O card do funil afirma SEMPRE "quando a navegação passou a ser rastreada", e em 7 e 30 dias essa data é só o filtro do topo — a data verdadeira é 03/jul

- **Onde:** `src\features\solucoes\solucoes-page.tsx:310-315`
- **Categoria:** regua-nao-declarada
- **Evidência:** A descrição é um ternário sobre `conversao.data?.[0]?.desde`:  ``` description={   'Catálogo → detalhe → início → conclusão · usuários únicos' +   (conversao.data?.[0]?.desde     ? ` desde ${formatDateShort(conversao.data[0].desde)}, quando a navegação passou a ser rastreada`     : ` nos últimos ${periodo} dias`) } ```  No banco, `desde` é `(select ini + 1 from janela)` com `ini = greatest(h.d - p_dias, (select min(data_brt) from marts.fact_pageview) - 1)` — `greatest` de dois não-nulos NUNCA é nulo, e `database.types.ts:1086` gera `desde: string` (não anulável). O ramo do `else` é código morto: nunca executa com dado carregado.  SQL rodado, `bi_solucoes_conversao_tela(7|30|90)` + `min(data_brt)`: - min(data_brt) de fact_pageview = **2026-07-03** · data_referencia() = 2026-08-19 - p_dias=7 → desde = **2026-08-13** → a tela escreve "desde 13 de ago, quando a navegação passou a ser rastreada". Falso: é `d-7+1`. - p_dias=30 → desde = **2026-07-21** → "desde 21 de jul, quando a navegação passou a ser rastreada". Falso: é `d-30+1`. - p_dias=90 → desde = **2026-07-03** → verdadeiro (aí sim o `greatest` mordeu).  O próprio docstring de `formatDateShort` (src/lib/format.ts:88-92) cita o caso certo — "desde 3 de jul, quando a navegação passou a ser rastreada" —, o que mostra que a frase foi escrita para o recorte de 90 e acabou disparando nos três. Efeito: em 30 dias (o padrão da tela) o leitor conclui que o funil ignora o seletor do topo, quando ele obedece; e conclui que o rastreio começou em 21/jul, quando começou em 03/jul.
- **Conserto proposto:** O banco já tem os dois pedaços da informação; falta separá-los. Acrescentar em `bi_solucoes_conversao_tela` uma coluna `recortada boolean` (`(h.d - p_dias) < (select min(data_brt) from marts.fact_pageview) - 1`) e trocar o ternário para condicionar em `recortada`, não em `desde`: recortada → "desde {desde}, quando a navegação passou a ser rastreada"; não recortada → "nos últimos {periodo} dias". Isso mata o ramo morto e devolve a frase certa em cada recorte.

### Atenção · A coluna Nota é publicada sem amostra e sem supressão em dois cards — todas as 80 notas têm menos de 30 avaliações, e 10 delas saem de UMA pessoa

- **Onde:** `src\features\solucoes\solucoes-page.tsx:162 e :202-204 (ranking); :246 e :281-283 (candidatas)`
- **Categoria:** regua-nao-declarada
- **Evidência:** SQL rodado sobre `public.bi_solucoes_ranking(200)` (os mesmos argumentos da página, `queries.ts:21`):  com_nota = **80** de 158 publicadas · nota com <30 avaliações = **80** (todas) · com <5 avaliações = **45** · com exatamente 1 avaliação = **10** · min(avaliacoes) = 1 · max(avaliacoes) = **26**.  A view `marts.v_metricas_solucao` faz `round(avg(a.nota), 2)` sem nenhum `having` — não há piso de amostra em lugar nenhum do caminho. A tela imprime `{r.nota != null ? formatDecimal(r.nota) : '—'}` nos dois cards e a descrição do ranking diz só "nota em escala 0–10", sem uma palavra sobre quantas avaliações. A RPC **já devolve `avaliacoes`** (está no `RETURNS TABLE` e em `database.types.ts:1136`) e a tela simplesmente não a mostra.  O peso vem do segundo card: "Candidatas a remoção ou revisão" é `nivel="prescritivo"` e a descrição dele manda ponderar a nota — "nota alta com pouco uso pode ser problema de descoberta, não de qualidade". Ou seja, a tela pede uma decisão de catálogo apoiada numa média que pode ser a opinião de uma pessoa, apresentada com o mesmo peso tipográfico de uma média de 26. E o projeto tem régua declarada de suprimir média/percentual com denominador <30 (migration 20260811175116).
- **Conserto proposto:** Duas opções, e a segunda é mais barata que a primeira. (a) Mostrar a amostra: coluna "Nota" passa a imprimir `formatDecimal(r.nota)` seguida de `(n)` com `r.avaliacoes` — o dado já vem na RPC, custo zero de banco, mas soma 0 coluna e sobe o número impresso numa tela que já está no teto de 30. (b) Suprimir no banco: `having count(*) >= N` no CTE `aval` da `marts.v_metricas_solucao`, com N declarado, e a descrição do card ganhando "nota só a partir de N avaliações" — que é o padrão de supressão que o resto do produto usa. Em qualquer das duas, o teto de amostra medido (26) precisa entrar na descrição, porque N=30 zeraria a coluna inteira.

### Atenção · A prosa da seção e a da camada de dados afirmam como regra que pageviews "ficam abaixo das iniciadas" — não ficam em 46 das 158 linhas da própria tabela

- **Onde:** `src\features\solucoes\solucoes-page.tsx:150 (prosa da seção) e :531 (descrição da fonte na AbaDeDados)`
- **Categoria:** numero-errado
- **Evidência:** Dois textos afirmam isso sem hedge: - prosa da SecaoDeAnalise (linha 150): "Pageviews vêm da navegação, só desde jul/2026, e **ficam abaixo das iniciadas**." - descrição da fonte na AbaDeDados (linha 531): "pageviews só desde jul/2026, então **ficam abaixo das iniciadas**".  SQL rodado: `select count(*) filter (where pageviews > iniciadas) from public.bi_solucoes_ranking(200)` → **46** de 158 (29,1%). Também medido: pageviews = 0 em 0 linhas, iniciadas = 0 em 0 linhas.  A razão é estrutural e derruba a inferência da frase: `iniciadas` conta linhas de `fact_progresso_solucao` (uma por pessoa por solução, histórico), enquanto `pageviews` conta ACESSOS (`count(*)` de `fact_pageview`, várias visitas da mesma pessoa) — a janela mais curta não garante nada sobre a ordem dos dois. O card "Candidatas" acerta ao hedgear ("**podem** ficar abaixo", linha 246); os outros dois lugares publicam como regra. Quem usar a regra para ler a tabela bate em 46 linhas que a contradizem, na mesma tela.
- **Conserto proposto:** Trocar a afirmação pelo fato que a explica, nos dois lugares: "pageviews contam acessos desde jul/2026; iniciadas contam pessoas por solução, no histórico completo — os dois não são comparáveis linha a linha". Cabe no orçamento de 240 caracteres da prosa da seção (hoje em 235, a mudança encurta). Ou alinhar com o hedge que a Candidatas já usa.

### Atenção · O KPI "Conclusão (histórica)" tem denominador de 54.452 progressos, incluindo soluções não publicadas — todo card da tela usa 49.737, e a taxa dá 5,0% em vez de 4,9%

- **Onde:** `src\features\solucoes\solucoes-page.tsx:133-139 (KpiCard) · public.bi_solucoes_kpis, 4ª subconsulta`
- **Categoria:** numero-errado
- **Evidência:** `bi_solucoes_kpis` calcula a última coluna sem nenhum filtro de solução:  ``` (select round(count(*) filter (where p.concluido)::numeric / nullif(count(*), 0), 4)  from marts.fact_progresso_solucao p  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente) ```  SQL rodado: denominador = **54.452** progressos, taxa = **0,0494** → a tela imprime 4,9%.  Mas todo card abaixo restringe a soluções publicadas. `bi_solucoes_por_categoria` (`where s.publicada`) somado: iniciadas = **49.737**, concluidas = 2.492 → **0,0501** → 5,0%. São 4.715 progressos (8,7% do denominador) em soluções que não estão publicadas e portanto não existem em nenhuma tabela nem barra da tela.  O KPI vizinho na mesma fileira diz "Soluções publicadas · 158" (conferido: `dim_solucao where publicada and not em_breve` = 158), o que induz o leitor a ler os quatro tiles como um conjunto sobre as 158. A conclusão histórica não é. O rótulo "(histórica)" declara a janela e não declara o universo, e a tela não tem onde reconciliar 4,9% com 5,0%.
- **Conserto proposto:** Alinhar o universo do KPI ao dos cards: `join marts.dim_solucao s on s.id = p.solution_id and s.publicada` na 4ª subconsulta de `bi_solucoes_kpis` (migration + purga de `insights.achado_cache where chave like 'solucoes|%'` se algum gabarito passar a citar o valor). Se a decisão for medir tudo que já foi tentado, inclusive catálogo despublicado, então o rótulo tem de dizer isso — "Conclusão (histórica, todo o catálogo)" — porque hoje ele empresta o universo do tile ao lado.

### Atenção · O funil da tela é desenhado como sequência ("Catálogo → detalhe → início → conclusão", "% do catálogo") mas os quatro degraus são conjuntos independentes — o card irmão declara exatamente esse cuidado, este não

- **Onde:** `src\features\solucoes\solucoes-page.tsx:298-321 (descrição e headline) e :322-343 (cabeçalho "% do catálogo")`
- **Categoria:** regua-nao-declarada
- **Evidência:** Lido CTE por CTE em `bi_solucoes_conversao_tela`: `catalogo` conta usuários de `fact_pageview` com `path = '/solucoes'`; `detalhe`, `path like '/solucoes/%'`; `iniciou` e `concluiu` saem de `fact_progresso_solucao`. **Nenhum degrau é subconjunto do anterior** — não há join com o conjunto de cima. Quem concluiu na janela pode nunca ter aberto o catálogo nela (e provavelmente começou antes: a conclusão leva tempo). Mesmo assim o `pct` de todos divide por `catalogo`, o cabeçalho da coluna é "% do catálogo" e o headline diz "3,4% **do catálogo chega a concluir**".  O próprio motor sabe disso e escreve na aba Análise (`insights.regra.gabarito_leitura` de `sol_conclusao_apos_inicio`): "O funil conta gente distinta em cada degrau da mesma janela, não a mesma pessoa descendo os quatro. Quem concluiu pode ter começado antes da janela, então este número é generoso." A ressalva existe numa aba e não existe no card.  Agrava por dois motivos. (1) O card declara `nivel="diagnostico"`, cuja exigência em `escada.ts` é "taxa com denominador correto e ao menos um confundidor declarado" — a descrição não declara nenhum. (2) O card vizinho na MESMA seção declara o equivalente com todas as letras: "As abas são independentes — dá para concluir uma sem passar pela anterior —, então não é funil: valor baixo é aba pulada, não abandono." Um leitor que aprende a régua num card a aplica ao outro ao contrário.  Medido nos três recortes, o número não estoura hoje (7d: 1.342→964→739→31; 30d: 3.339→2.330→2.069→115; 90d: 4.383→3.020→2.823→162), então o defeito é de leitura, não de aritmética.
- **Conserto proposto:** Levar para a descrição do card a frase que já existe no `gabarito_leitura`, no formato curto do card irmão: "Cada degrau conta gente distinta na mesma janela, não a mesma pessoa descendo os quatro — quem concluiu pode ter começado antes, então o último degrau é generoso." Cabe em uma linha e é o confundidor que o `nivel="diagnostico"` já exigia.

### Atenção · O achado "A atenção não segue o tamanho do catálogo" lidera com 8,4% dos pageviews por categoria, e a âncora leva a uma tabela onde esse número não aparece

- **Onde:** `insights.regra id='sol_atencao_por_categoria' (gabarito e ancora_id) · card em src\features\solucoes\solucoes-page.tsx:212-238`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** Rodado `insights.calcular_achados_solucoes(30)`: a regra `sol_atencao_por_categoria` dispara (score 1,47, não suprimida) com `parametros = {cat_topo: Financeiro, solucoes_topo: 6, parte_catalogo: 0.038, parte_pageviews: 0.0839, indice: 2.211}`. O gabarito publica: "Financeiro tem 6 soluções publicadas, 3,8% do catálogo, e leva **8,4% dos pageviews** de página de solução — 2,211× a atenção que o tamanho dela faria esperar."  O `ancora_id` da regra é **card-ranking-solucoes**. Lido o card: ele imprime pageviews POR SOLUÇÃO, 12 linhas por página, 158 linhas ao todo (14 páginas). Para conferir os 8,4% o leitor teria de somar os pageviews das 6 soluções de Financeiro e dividir pela soma das 158 — o número não existe impresso.  E existe um card por categoria na tela ("Uso por categoria"), que desenha **iniciadas**, não pageviews nem contagem de soluções: `parte_catalogo` (6/158) e `parte_pageviews` também não estão lá. É o caso que o CLAUDE.md nomeia — "o número da frase existe num card da tela — sempre" — com o agravante de a tela ter o card certo desenhando a medida errada.  Ponto a favor do motor, conferido: o limite bate (`bi_solucoes_ranking(200)` no calculador e `p_limite: 200` em `queries.ts:21`) e há guarda declarada para o corte (`when (select count(*) from rk) >= 200 then 'ranking devolvido no limite da consulta'`). O problema é só o número não desenhado.
- **Conserto proposto:** Alinha com o conserto do achado 1: se `bi_solucoes_por_categoria` passar a devolver `pageviews` e `solucoes` como colunas e o card "Uso por categoria" ganhar a fatia de atenção pelo canal `nota` do CategoryBarChart ("Financeiro: 8,4% dos pageviews, 3,8% do catálogo"), o número passa a existir e a âncora muda para o card de categoria — que é a pergunta que o achado faz. Sem isso, o caminho é a regra parar de liderar por uma fatia que a tela não desenha.

### Observação · "Publicada" tem duas réguas na mesma tela: o KPI exclui "em breve", o ranking não — hoje empatam em 158 por acaso

- **Onde:** `public.bi_solucoes_kpis (1ª subconsulta) × public.bi_solucoes_ranking (where) · cards em src\features\solucoes\solucoes-page.tsx:112-118 e :168-176`
- **Categoria:** numero-errado
- **Evidência:** SQL rodado numa consulta só: - `bi_solucoes_kpis(30).publicadas` = 158, vindo de `count(*) from marts.dim_solucao where publicada **and not em_breve**` - `count(*) from public.bi_solucoes_ranking(200)` = 158, vindo de `marts.v_metricas_solucao where publicada` (**sem** o `and not em_breve`) - `dim_solucao where publicada` = 158 · `where publicada and not em_breve` = 158 · total = 168  Os dois números batem hoje **porque não existe nenhuma solução publicada e marcada `em_breve`** — o predicado extra não morde. `bi_solucoes_candidatas_remocao` usa a régua estrita (`publicada and not em_breve`), o ranking usa a frouxa.  A divergência é visível quando aparecer: o rodapé da TabelaLonga imprime "Mostrando 1–12 de 158" (`tabela-longa.tsx`, `formatInt(filtradas.length)`), então a tela publica o mesmo 158 em dois lugares, de duas fontes e com duas definições. Uma solução publicada em "em breve" faria o rodapé dizer 159 ao lado de um KPI dizendo 158, sem erro nenhum.
- **Conserto proposto:** Escolher uma régua e aplicá-la nas três funções. O candidato natural é a estrita (`publicada and not em_breve`), que é a que `bi_solucoes_candidatas_remocao` já usa e a que faz sentido para um catálogo — solução "em breve" não tem uso a medir. Migration em `bi_solucoes_ranking` acrescentando `and not em_breve`; nenhum número muda hoje, e a coincidência para de ser coincidência.

### Observação · O rótulo da primeira etapa do funil carrega a rota crua /solucoes

- **Onde:** `public.bi_solucoes_conversao_tela (CTE final, values) · renderizado em src\features\solucoes\solucoes-page.tsx:333`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** `bi_solucoes_conversao_tela` devolve os rótulos por `values`, e o primeiro é literalmente `'Abriu o catálogo /solucoes'` — conferido na saída da RPC nos três recortes (7/30/90 dias), sempre com esse texto. A tela imprime a célula direto: `<TableCell className="font-medium">{c.etapa}</TableCell>`.  As outras três etapas são pt-BR limpo ("Abriu alguma solução", "Iniciou uma solução", "Concluiu uma solução"), o que deixa a rota como a única marca de implementação na coluna. O resto da tela foi cuidadoso nisso — `bi_solucoes_conclusao_por_aba` traduz os enums da origem (`tools`→Ferramentas, `resources`→Materiais, `checklist`→Checklist), e nenhum outro identificador técnico aparece fora da AbaDeDados, onde é por desenho.
- **Conserto proposto:** Migration trocando o rótulo por "Abriu o catálogo de soluções". A rota não some da tela — ela continua na AbaDeDados, que é onde ela serve (auditabilidade), e o caminho `path = '/solucoes'` segue no corpo da função para quem for conferir no banco.

---

## ia — 10 achados (2 de risco alto)

### Risco alto · A seção "Onde o Builder trava" inteira é telemetria de máquina: 19 slugs de código em fonte monoespacada, taxa de erro técnica e tempo em segundos

- **Onde:** `src/features/ia/ia-page.tsx:476-532 (seção), 486 (título), 494 (headline com slug), 497 (descrição), 513-514 (colunas Erro/Tempo médio), 519 (step em font-mono)`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** Rodei `select * from public.bi_builder_steps(90)` (o mesmo argumento da página, queries.ts: `p_dias: 90`). As 19 linhas devolvidas são identificadores crus de engenharia, sem tradução nenhuma: doc_plano, doc_prs, estrutura, doc_schemas, doc_functions, doc_paginas, doc_prd, action_plan, prompt_lovable, doc_skill, doc_readme, tools, doc_depara, processo, framework, knowledge_base, architecture, content, savings. A página os imprime literalmente, em `<TableCell className="font-mono text-xs">{s.step}</TableCell>` (ia-page.tsx:519), e ainda repete um deles no headline: `de erro na etapa mais frágil (${etapaMaisFragil.step})` → "de erro na etapa mais frágil (action_plan)" (ia-page.tsx:494). As colunas são "Gerações", "Erro" e "Tempo médio" — `pct_erro` sai de `count(*) filter (where s.status = 'error')` e `segundos_medio` sai de `avg(s.tempo_ms)/1000.0`, ou seja, milissegundos de máquina e taxa de erro técnica. O próprio comentário DENSIDADE_DECLARADA na página (linhas 466-475) admite: "é a única leitura de MÁQUINA do módulo". Medido: 15 das 19 etapas publicam 0,00% de erro; o maior valor da tela inteira é 0,29%. É a definição do que o Mateus decidiu tirar hoje.
- **Conserto proposto:** Tirar a seção "Onde o Builder trava" e o card `card-builder-etapas` da tela. Consequências a tratar no mesmo commit, porque nada disso some sozinho: (1) a regra `insights.regra` id `ia_builder_espera` aponta `ancora_id = 'card-builder-etapas'` — o link "Ver o gráfico que sustenta" das abas Análise e Plano fica apontando para um id que não existe mais; a regra sai junto (delete em insights.regra + o bloco `bst`/`bst_agg`/`r_builder` de `insights.calcular_achados_ia`) e a migration termina com `delete from insights.achado_cache where chave like 'ia|%'`; (2) a régua de `/ia` em nav-items.ts:260-261 diz "Adoção, recorrência e confiabilidade do Consultor e do Builder" — sai o "e confiabilidade"; (3) a fonte `bi_builder_steps` sai da lista da AbaDeDados (ia-page.tsx:595-603) e o hook `useBuilderSteps` sai de queries.ts; (4) o teto de `features/ia/ia-page.tsx` em TETO_POR_TELA cai de {cards:8, colunas:17} para {cards:7, colunas:13} (baixar é de graça pela própria regra da densidade.ts), e a seção sobrevivente "O que acontece com quem experimenta a IA" passa a ser a última — conferir `prescritivoNaoSoNoFim`, porque o prescritivo `card-experimentaram-e-sumiram` passaria a estar só na última seção e a régua reprova. A ordem provável: mover a seção 3 para antes da 2, ou promover a lista de ação para cima.

### Risco alto · O card chamado "confiabilidade" publica 0,0% de erro em etapas onde 6% a 9% das gerações nunca terminaram — e a frase do motor conclui daí que "o atrito é espera, não erro"

- **Onde:** `public.bi_builder_steps (corpo da função); consumido em src/features/ia/ia-page.tsx:482-530 e em insights.calcular_achados_ia (CTE `bst_agg`, `r_builder`)`
- **Categoria:** numero-errado
- **Evidência:** `bi_builder_steps` calcula `pct_erro` como `count(*) filter (where s.status = 'error') / count(*)`. Rodei a distribuição de status na mesma janela e com o mesmo join de e_cliente da RPC: completed 18.811 · pending 1.076 · error 10 · generating 2 (19.899 no total). Ou seja, a coluna "Erro" mede 10 eventos e ignora 1.088 gerações que nunca concluíram. Por etapa, `pct_erro_publicado` × `pct_nao_concluiu`: prompt_lovable 0,00% × 7,17% (98 pendentes) · doc_readme 0,00% × 8,22% (67) · architecture 0,00% × 6,07% (83) · savings 0,07% × 8,71% (118) · action_plan 0,29% × 8,56% (113). E não são gerações em voo: dos 1.088 pendentes, 1.013 têm mais de 7 dias (`select count(*) filter (where criado_em::date <= data_referencia()-7)`), o mais antigo de 24/mai/2026. A segunda coluna herda o mesmo cego: `segundos_medio` é `avg(s.tempo_ms) filter (where s.status = 'completed')`, então "Tempo médio" descreve só a geração que deu certo — a que travou não entra nem no erro nem no tempo, e a tela não diz isso em lugar nenhum (descrição em ia-page.tsx:497 fala só em "Gerações dos últimos 90 dias · ordenado pelas etapas mais lentas"). O efeito não fica no card: a regra `ia_builder_espera` só dispara `when a.erro_max >= 1 then 'há etapa com erro acima de um por cento...'` — com erro_max = 0,29 ela passa, e as abas Análise e Plano publicam o título "No Builder, o atrito é espera, não erro" sobre uma base em que 5,5% das gerações simplesmente pararam.
- **Conserto proposto:** Se a seção ficar (ver achado anterior), trocar `status = 'error'` por `status <> 'completed'` na conta de falha e renomear a coluna para "Não concluiu", ou publicar as duas colunas separadas (erro e abandonada); e escrever na descrição que o tempo médio só conta geração concluída. A regra `ia_builder_espera` precisa ser recalibrada junto, porque o limiar `erro_max >= 1` foi calibrado contra a métrica errada — com `<> 'completed'` o maior valor passa a ser 8,7% e a regra inverte de assunto. Se a seção sair, sai o problema junto — mas a frase publicada tem de sair com ela.

### Atenção · O headline da Recorrência acha a faixa "1 dia" por `startsWith('1')`, que também casa com "16+ dias"

- **Onde:** `src/features/ia/ia-page.tsx:92-98 (linha 96)`
- **Categoria:** numero-errado
- **Evidência:** ia-page.tsx:96: `const umDia = faixas.find((r) => r.faixa.startsWith('1'))?.usuarios ?? 0`. As faixas que `bi_consultor_recorrencia` produz são, do próprio corpo da função: '1 dia', '2–3 dias', '4–7 dias', '8–15 dias', '16+ dias'. `'16+ dias'.startsWith('1')` é `true`. Hoje o número está certo por acidente de ordenação: a RPC termina com `order by ordem` e '1 dia' (ordem 1) chega antes de '16+ dias' (ordem 5), então `find` para no primeiro. Conferi os três períodos do seletor — p=7: 345/64/8 (sem a faixa 16+); p=30: 826/314/85/15 (sem a faixa 16+); p=90: 1567/798/268/67/8 (com as duas). Em p=90 o `find` devolve 1567, que é o certo. Mas basta a faixa '1 dia' vir vazia (grupo ausente no `group by`) para o `find` pegar '16+ dias' e o headline saltar de "voltam em mais de um dia" para um valor quase 100% sem erro nenhum. O chave robusto está na própria linha e não é usado: a RPC devolve `ordem`, e o motor determinístico faz certo — `insights.calcular_achados_ia` usa `filter (where r.ordem > 1)` com o comentário "ordem > 1 é toda faixa acima de '1 dia' na régua da própria RPC". O front e o SQL discordam de método sobre o mesmo número.
- **Conserto proposto:** Trocar por `faixas.find((r) => r.ordem === 1)?.usuarios ?? 0`, que é a chave que a RPC devolve para isso e a mesma que o motor já usa.

### Atenção · O card comparativo de impacto na retenção não declara margem, que é justamente o que a escada exige do degrau

- **Onde:** `src/features/ia/ia-page.tsx:363-375 (nivel na 365, description na 370)`
- **Categoria:** regua-nao-declarada
- **Evidência:** `escada.ts` define comparativo como exigindo "dois grupos nomeados ou duas janelas, **com a margem declarada**". O card `card-impacto-ia` declara `nivel="comparativo"` (ia-page.tsx:365) e a descrição (linha 370) diz apenas "Clientes que entraram a partir do lançamento do Consultor (11/mai/2026) e já têm 60+ dias de casa · retenção medida entre os dias 30 e 60 · correlação, não causalidade" — nenhuma margem. O card vizinho, `card-modo-de-entrada`, declara ("margem de 6,2 pp") porque a RPC dele devolve `margem_pp`; `bi_ia_impacto_retencao` não devolve coluna equivalente (conferi o `RETURNS TABLE`: grupo, clientes, retidos, pct_retencao). Rodei a RPC: 'Usou IA na 1ª semana' 433 clientes / 170 retidos / 39,26% · 'Não usou IA' 1.881 / 439 / 23,34%. A margem real é pequena (2·√(0,3926·0,6074/433 + 0,2334·0,7666/1881) ≈ 5,0 pp contra 15,9 pp de diferença), então ninguém está sendo enganado hoje — o que falta é a régua na tela, não o número. Vale notar que o motor JÁ calcula essa margem: `insights.calcular_achados_ia` tem `when p.taxa_com - p.taxa_sem < 2 * sqrt(...)` como critério de supressão. O cálculo existe no banco e não chega ao card.
- **Conserto proposto:** Devolver `margem_pp` de `bi_ia_impacto_retencao` com a mesma fórmula que a supressão da regra já usa (é o mesmo `2*sqrt(p(1-p)/n)` dos dois grupos) e emendar na descrição: "· margem de X pp", igual ao card de porta de entrada logo acima.

### Observação · Os modos do Consultor chegam à tela como enum cru minúsculo — "chat" e "planejamento" — inclusive no headline do único card de destaque

- **Onde:** `src/features/ia/ia-page.tsx:271, 336, 346`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** `select * from public.bi_consultor_modos()` devolve `chat` (5.955 threads) e `planejamento` (1.209). `marts.fact_consultor_thread.modo` é `text` cru vindo da plataforma, sem coluna de exibição (conferi as colunas da tabela: id, user_id, modo, mensagens, criado_em, sincronizado_em). A página imprime o valor sem tradução em três lugares: como categoria do gráfico (ia-page.tsx:346 `category: m.modo`), no headline do card de destaque (`tone="brand"`, linha 336 `em ${modoLider.modo}` → "83,1% em chat") e na primeira coluna da tabela de porta de entrada (linha 271 `{m.modo}`), onde o headline também repete ("voltam ao estrear em planejamento, contra 46,3% em chat"). A RPC ainda tem `coalesce(t.modo, '(sem modo)')`, que hoje não devolve linha nenhuma mas entraria igualmente cru. Não é um número errado — é o rótulo cru do banco no card de maior destaque visual da tela.
- **Conserto proposto:** Mapear os dois valores para pt-BR de produto no ponto de leitura ("Conversa aberta" / "Planejamento", ou o nome que o produto usa na plataforma), do mesmo jeito que outras telas fazem com papel/plano — de preferência num helper compartilhado, porque dois cards desta tela leem o mesmo enum e um `case` no SQL de uma RPC só deixaria a outra desalinhada.

### Observação · Dois headlines são percentuais calculados no front sobre contagem, sem a supressão por amostra que o banco aplica

- **Onde:** `src/features/ia/ia-page.tsx:92-98 e 100-106`
- **Categoria:** numero-errado
- **Evidência:** ia-page.tsx:92-98: `voltamOutroDia = (total - umDia) / total`, com `total` somado das linhas de `bi_consultor_recorrencia` — vira "33,4% voltam em mais de um dia". ia-page.tsx:100-106: `modoLider.parte = maior.threads / total`, somado das linhas de `bi_consultor_modos` — vira "83,1% em chat". Conferi que as duas RPCs são partições completas (nenhuma tem LIMIT nem HAVING no corpo), então somar é legítimo pela régua do CLAUDE.md; o que escapa é a supressão. `AMOSTRA_MINIMA = 30` (src/lib/segmento.ts:52) e o contrato da casa é "quem suprime percentual com denominador < 30 é o banco" — aqui a conta é do front e não tem guarda nenhuma. O motor determinístico, sobre exatamente o mesmo número, tem: `when a.usuarios < 30 then 'menos de trinta clientes usaram o Consultor no período'`. Medi os denominadores nos três períodos do seletor e nenhum chega perto do piso — recorrência 417 (7d) / 1.240 (30d) / 2.708 (90d), modos 7.164 (histórico completo, sem seletor). Então hoje nenhum número está errado; o que falta é a trava, e a tela não tem filtro de segmento que possa derrubar o denominador.
- **Conserto proposto:** Devolver a taxa já calculada e já suprimida pela RPC (uma coluna `pct_volta_multi_dia` em `bi_consultor_recorrencia`, com `case when total >= 30 then ... end`, e o equivalente em `bi_consultor_modos`), e a página só formatar — que é o padrão dos outros cards da tela, onde `pct_volta` e `pct` já vêm com o `case when count(*) >= 30` do banco.

### Observação · `bi_builder_steps` tem `having count(*) >= 20` que a tela não declara

- **Onde:** `public.bi_builder_steps (cláusula having); tela em src/features/ia/ia-page.tsx:497 e 596-603`
- **Categoria:** regua-nao-declarada
- **Evidência:** O corpo da função termina com `group by s.step having count(*) >= 20 order by 4 desc nulls last`. Nem a descrição do card (ia-page.tsx:497) nem a da fonte na AbaDeDados (linha 598: "janela fixa de 90 dias · a unidade é a geração, não a pessoa") mencionam o piso. Medi o quanto ele morde hoje: `select count(*) etapas_totais, count(*) filter (where n>=20) publicadas, count(*) filter (where n<20) ocultas` sobre o mesmo agregado → 19 totais, 19 publicadas, 0 ocultas. Ou seja, hoje o corte não esconde nada — mas, diferente da lista de "Experimentaram e sumiram", onde a página compara `sumiram.data.length >= LIMITE_LISTA` e só declara quando o corte morde (ia-page.tsx:416-420), aqui o front não tem como saber que a etapa existiu: ela simplesmente não vem na resposta.
- **Conserto proposto:** Se a seção sobreviver ao primeiro achado: acrescentar "· etapa com menos de 20 gerações não aparece" na descrição do card e na da fonte, no mesmo formato já usado no card de porta de entrada ("modo com menos de 30 estreantes não aparece").

### Observação · A régua do módulo diz "rastreado desde mai/2026", mas o Builder tem dado desde out/2025

- **Onde:** `src/components/layout/nav-items.ts:260-261`
- **Categoria:** regua-nao-declarada
- **Evidência:** nav-items.ts:260-261: `regua: 'Adoção, recorrência e confiabilidade do Consultor e do Builder · rastreado desde mai/2026'` — uma frase só, cobrindo as duas ferramentas. Medi as quatro origens da tela: fact_consultor_thread 11/mai/2026 → 19/ago/2026 (10.454 linhas) · fact_consultor_uso_diario 11/mai/2026 → 19/ago/2026 (6.885) · fact_builder_solucao **26/out/2025** → 19/ago/2026 (7.150) · fact_builder_step **06/mar/2026** → 19/ago/2026 (41.918). O "desde mai/2026" é a data do Consultor, não do Builder. Nenhum card publica hoje um número anterior a mai/2026 (os do Builder usam janela de 90 dias ou o período do topo), então nenhum número está errado — mas a régua é o que o leitor usa para saber o que pode perguntar, e ela está afirmando que sete meses de Builder não existem.
- **Conserto proposto:** Separar as duas datas na régua: "Consultor rastreado desde mai/2026, Builder desde out/2025" — ou, se a seção do Builder sair pelo primeiro achado, a régua fica só com o Consultor e a data passa a estar certa por construção.

### Observação · O mesmo número (1.240 e 539) é calculado por duas RPCs diferentes, com definições duplicadas em SQL

- **Onde:** `public.bi_ia_kpis e public.bi_ia_adocao (CTEs `cons`/`buil`); consumidos em src/features/ia/ia-page.tsx:124-151 e 186-199`
- **Categoria:** numero-errado
- **Evidência:** `bi_ia_kpis` calcula `usuarios_consultor` como `count(distinct c.user_id) from marts.fact_consultor_uso_diario c join dim_usuario u ... and u.e_cliente where c.data_brt > h.d - p_dias`. `bi_ia_adocao` calcula a CTE `cons` com exatamente o mesmo predicado, e o publica no tooltip do card como `alcance_consultor` (ia-page.tsx:195, "Consultor ao todo: 1.240"). O mesmo par existe para o Builder (`usuarios_builder` × `alcance_builder`). São duas cópias literais da mesma definição em duas funções. Conferi nos três períodos: p=7 → KPI 417/170 e soma das barras da recorrência 345+64+8 = 417 ✓; p=30 → KPI 1.240/539, adoção `alcance_consultor` 1.240 e `alcance_builder` 539, recorrência 826+314+85+15 = 1.240 ✓; p=90 → KPI 2.708/1.242, recorrência 1567+798+268+67+8 = 2.708 ✓. Batem em todos, então não há número errado hoje — o defeito é a segunda conta existir e poder divergir sem nada quebrar, que é a mesma classe do commit fac9008 ("A fileira de KPI parava de bater com o card logo abaixo").
- **Conserto proposto:** Fazer `bi_ia_kpis` ler `usuarios_consultor`/`usuarios_builder` de `bi_ia_adocao(p_dias)` (as colunas `alcance_consultor`/`alcance_builder` já saem prontas de lá, iguais em toda linha), em vez de repetir o `count(distinct)`. As duas colunas de volume (mensagens_consultor, solucoes_builder) continuam onde estão.

### Observação · `bi_ia_experimentaram_e_sumiram` devolve uma coluna `ativo_no_produto` que é a constante `true`

- **Onde:** `public.bi_ia_experimentaram_e_sumiram (RETURNS TABLE e select); reflete em src/types/database.types.ts:664 e na AbaDeDados`
- **Categoria:** codigo-morto
- **Evidência:** O corpo da função tem literalmente `true as ativo_no_produto` no select, e o `where` já garante a condição (`exists (select 1 from marts.fact_evento f where f.user_id = x.user_id and f.data_brt > r.d - 30)`) — nenhuma linha devolvida pode ter valor diferente. A página não lê a coluna (ia-page.tsx:441-460 usa nome, email, organizacao, plano, ultima_conversa, dias_sem_ia). Ela não some da tela, porém: a AbaDeDados renderiza todas as colunas da linha (`const colunas = linhas[0] ? Object.keys(linhas[0]) : []`) e `CelulaBruta` formata booleano como "sim", então a aba do dado ganha uma coluna com 294 "sim" idênticos. Rodei `select count(*) from public.bi_ia_experimentaram_e_sumiram(5000)` (o argumento da página é `p_limite: LIMITE_LISTA` = 5000) → 294 linhas, bem abaixo do teto, o que confirma de passagem que a não-declaração do corte na descrição está correta.
- **Conserto proposto:** Tirar `ativo_no_produto` do `RETURNS TABLE` e do select, e regenerar os types com `npm run db:types`. A condição continua no `where`, que é onde ela de fato vale.

---

## organizacoes — 13 achados (3 de risco alto)

### Risco alto · A coluna "Assentos ociosos" é 25 zeros, e zero ali quer dizer "sem limite contratado"

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:270 e 293-295 (cabeçalho e célula) · public.bi_orgs_risco`
- **Categoria:** numero-errado
- **Evidência:** O SQL de `bi_orgs_risco` calcula `greatest(coalesce(team_limit, 0) - membros::integer, 0)` — org sem limite vira 0 - membros → negativo → 0. Rodei a RPC com o argumento da página (`p_limite: 25`): `select count(*) linhas, count(*) filter (where assentos_ociosos = 0) zeros, max(assentos_ociosos) from public.bi_orgs_risco(25)` → linhas=25, zeros=25, maior=0. E conferi a causa linha a linha: das 25 linhas, **25 têm `team_limit is null`** (query sobre `marts.v_saude_organizacao` com o mesmo `where ativa and membros >= 3` e o mesmo `order by`). Não é "nenhum assento sobrando": é limite não definido. O próprio card vizinho ("Ocupação de assentos") publica que 1.455 das 1.925 orgs ativas não têm limite — 75,6% da base. É exatamente o `?? 0` proibido em valor exibido, só que escrito em SQL.
- **Conserto proposto:** Trocar `coalesce(team_limit, 0)` por `case when team_limit is null then null else greatest(team_limit - membros::integer, 0) end` e deixar a célula imprimir '—' quando vier null (o padrão que a própria tela já usa em `pct_time_ativo` e `plano`). Com o dado de hoje a coluna inteira passaria a '—', o que é a informação verdadeira; se o CEO não quiser uma coluna de travessões, a saída é tirar a coluna e dizer na descrição que assento ocioso só existe para as 470 orgs com limite.

### Risco alto · A coluna "% de uso" usa DOIS denominadores diferentes, e em 2 das 3 linhas o denominador não está na tela

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:206 (cabeçalho "% de uso") e 219-221 (célula) · public.bi_valor_nao_consumido`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** `pg_get_functiondef(bi_valor_nao_consumido)`: a linha do pool divide por `sum(o.pool_mentoria)` (o próprio valor da coluna "Disponível"); as duas linhas de crédito dividem por `sum(disponivel) + sum(usado)`. Rodei `select * from public.bi_valor_nao_consumido()`: pool → disponivel 15.624, usado 43, pct 0,0028 (= 43/15.624 ✓ bate com as colunas); individual → disponivel 199, usado 32, pct 0,1385 — e 32/199 = 0,1608, não 0,1385. O 13,85% sai de 32/231, e 231 não aparece em lugar nenhum da tela. O `comment on function` DECLARA a armadilha ('⚠️ O denominador da taxa é disponivel + usado, não disponivel: crédito usado saiu do disponível na origem') — a régua existe no banco e nunca chega na tela. Resultado: quem compara 0,28% do pool com 13,85% do individual está comparando duas razões diferentes sob o mesmo cabeçalho.
- **Conserto proposto:** Duas opções, as duas fecham: (a) a RPC passa a devolver `total` (= disponivel + usado nos créditos, = pool_mentoria no pool) e a tabela troca a coluna "Disponível" por "Contratado" mostrando esse total, com "Usado" ao lado — aí a divisão fecha na aritmética visível nas três linhas; ou (b) manter as colunas e trazer a cláusula do `comment on function` para a `description` do card ('nos créditos, Disponível é o saldo restante — a taxa divide por saldo + usado'). (a) é melhor: a régua vira mecanismo em vez de nota de rodapé.

### Risco alto · A tela publica dois valores para "organizações ativas" — 1.925 no KPI e 1.957 no denominador do card de distribuição

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:124-130 (KPI) e 314-319 (headline da distribuição) · public.bi_orgs_distribuicao_engajamento`
- **Categoria:** numero-errado
- **Evidência:** `bi_orgs_kpis` conta `count(*) filter (where ativa and membros > 0)`; `bi_orgs_distribuicao_engajamento` monta a base com `where v.ativa` apenas. Rodei as duas: KPI orgs_ativas = **1.925**; distribuição total_orgs = **1.957**, e o balde 'Sem membro nenhum' tem 32 orgs. Conferi a diferença direto na view: `count(*) filter (where ativa)` = 1957, `filter (where ativa and membros > 0)` = 1925, `filter (where ativa and membros = 0)` = 32. O headline do card diz '37,7% das contas ativas não têm ninguém aparecendo' — 738/1.957. Contra a base do KPI seria 38,3%. E na mesma tela a descrição de "Ocupação de assentos" imprime '470 de 1.925 orgs ativas', então o leitor vê 1.925 escrito por extenso num card e um denominador de 1.957 no outro. As outras cinco RPCs da tela (`kpis`, `por_tamanho`, `ocupacao`) usam `membros > 0`; a distribuição é a única fora do passo.
- **Conserto proposto:** Alinhar a base da distribuição ao resto da tela: `where v.ativa and v.membros > 0`, o que também remove o balde 'Sem membro nenhum' (que não é faixa de engajamento — é ausência de time) e faz total_orgs = 1.925. Se as 32 orgs sem membro forem informação que o CEO quer, elas são um aviso de limitação do dado fora do card, não uma linha do mesmo eixo. Migration precisa terminar com `delete from insights.achado_cache where chave like 'organizacoes|%'`.

### Atenção · "margem de 2,0 pp entre as pontas" é margem de ERRO — a diferença entre as pontas é 15,5 pp

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:380 (description do card "Quanto maior o time, menor a fatia que aparece")`
- **Categoria:** numero-errado
- **Evidência:** `bi_orgs_por_tamanho` calcula `round(200 * sqrt(sum(taxa*(1-taxa)/pessoas)), 1)` sobre as faixas 1 e 3 — isso é ±2 erros-padrão da diferença, não a diferença. Rodei a RPC: 'Até 5 pessoas' taxa 0,3624 (3.074 pessoas), 'Mais de 20 pessoas' taxa 0,2079 (6.901 pessoas), margem_pp = 2,0. Recalculei: 0,3624·0,6376/3074 + 0,2079·0,7921/6901 = 9,904e-5; sqrt = 0,009952; ×200 = 1,99 → 2,0 ✓ é margem de erro. A diferença real entre as pontas é 36,2% − 20,8% = **15,5 pp**. O texto do card diz 'margem de 2,0 pp entre as pontas' logo abaixo de um headline que mostra 20,8% contra 36,2% — quem lê 'entre as pontas' lê a diferença, e conclui que o gradiente é de 2 pp.
- **Conserto proposto:** Escrever 'diferença de 15,5 pp entre as pontas, com margem de erro de ±2,0 pp' — e tirar os dois números do dado, não da prosa (a diferença sai de `orgsPequenas.taxa - orgsGrandes.taxa`, a margem já vem em `margem_pp`). O comentário `-- Margem entre as duas pontas` dentro da migration tem a mesma ambiguidade e merece o mesmo ajuste.

### Atenção · As 25 orgs "em risco" estão todas empatadas em 0,0%; quem decide o corte é o TAMANHO, e isso não está escrito

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:241-246 (headlineLabel e description) e 261 (limiteDaFonte)`
- **Categoria:** regua-nao-declarada
- **Evidência:** `select count(*), min(pct_time_ativo), max(pct_time_ativo), count(*) filter (where pct_time_ativo = 0), min(membros) from public.bi_orgs_risco(25)` → 25 linhas, mínimo 0,0000, **máximo 0,0000**, 25 zeradas, menor time = 9 membros. E na base: `select count(*), count(*) filter (where pct_time_ativo = 0) from marts.v_saude_organizacao where ativa and membros >= 3` → **1.031 elegíveis, 251 zeradas**. Ou seja: o `order by pct_time_ativo asc, membros desc` empata em 251 linhas e quem entra nas 25 é decidido pelo desempate por tamanho. A tela diz só 'ordenadas pelo menor percentual de time ativo' e o rodapé da TabelaLonga diz 'a consulta traz no máximo 25' — nada informa que há 251 igualmente zeradas nem que o critério real de seleção é o número de membros. O headline ainda nomeia uma delas como 'a pior' ('0,0% de time ativo na pior (Global: hub de soluções...)'), quando 251 empatam. O '1.031' existia na prosa da seção e sumiu quando ela foi encurtada para caber nos 240 caracteres.
- **Conserto proposto:** A `description` passa a declarar o desempate e a base: 'Orgs ativas com 3+ membros · zeradas primeiro, maiores antes — 251 de 1.031 estão em 0% · lista para ação de CS'. Os dois números devem sair do banco (a RPC ganha colunas `elegiveis` e `zeradas`, como `bi_orgs_ocupacao` já faz com `orgs_com_limite`/`orgs_ativas`), nunca escritos à mão. E o headlineLabel troca 'na pior' por 'nas maiores contas zeradas', que é o que a ordenação de fato entrega.

### Atenção · "Valor contratado e não consumido" declara nivel="prescritivo" sendo um placar de 3 linhas agregadas, sem nome nenhum

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:177 (nivel="prescritivo" do TabelaCard "Valor contratado e não consumido")`
- **Categoria:** nivel-desonesto
- **Evidência:** `escada.ts` define prescritivo como 'o que fazer, **sobre quem**', exigindo 'lista acionável, ou ação com o número que a justifica'. A RPC é um `union all` de três literais (`'Pool de mentoria das organizações'`, `'Créditos de mentoria individual'`, `'Créditos de mentoria estratégica'`) com soma sobre a base inteira — rodei e são exatamente 3 linhas, sem grão de organização nem de pessoa. A própria `descricao` da seção admite o grão: 'uma linha é um benefício oferecido à base inteira, a outra é uma organização nomeada'. Não há sobre quem agir. Conferi que a correção não quebra régua nenhuma: com o card em `descritivo`, a tela fica em descritivo 2 (teto 3), comparativo 2 (mín 2), diagnóstico 2 (mín 2), prescritivo 1 (mín 1); `primeiraSecaoNaoSoDescritiva` continua ok porque o card de risco mantém a seção 1 com pico prescritivo, e `prescritivoNaoSoNoFim` também (o único prescritivo fica na seção 0, não na última). Rodei `npx vitest run` — 333 testes passam hoje e continuariam passando.
- **Conserto proposto:** Trocar para `nivel="descritivo"`. Se a intenção é mesmo prescritiva, o caminho é o card passar a listar QUAIS organizações têm pool contratado e zero consumo (grão de conta, nome na linha) — aí o degrau é honesto e o card vira a segunda lista de CS que a seção promete.

### Atenção · A coluna "Plano" imprime valor cru da plataforma — "basic" em minúscula ao lado de "Pro" e "Enterprise"

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:265 e 278 · public.bi_orgs_risco (select nome, plano, ...)`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** `select plano, count(*) from public.bi_orgs_risco(25) group by plano` → Pro 14, Enterprise 7, Starter 3, **basic 1**. Na base: `select plano, count(*) from marts.dim_organizacao where ativa group by plano` → Pro 1157, Starter 409, Enterprise 272, **basic 89, premium 25, enterprise 5**. São 119 orgs ativas carregando rótulo legado em minúscula, e `enterprise`/`Enterprise` são o mesmo plano publicado com dois nomes. A RPC devolve a coluna sem normalizar e a tela imprime direto (`{r.plano ?? '—'}`). É enum cru da origem chegando na tela do CEO.
- **Conserto proposto:** Normalizar no mart, não na tela (senão cada RPC que ler `plano` repete o mapa): uma função `marts.rotulo_de_plano(text)` ou uma coluna já normalizada em `dim_organizacao`, com `basic→Starter`? — a equivalência precisa ser confirmada com o Mateus antes, porque `basic`/`premium`/`enterprise` podem ser planos descontinuados e não sinônimos dos atuais. Enquanto a equivalência não estiver decidida, ao menos `initcap` não resolve (juntaria Enterprise com enterprise sem decisão); o mínimo honesto é mapear explicitamente e deixar sem mapa cair em '—'.

### Observação · "Master parado" inclui 13 organizações que não têm master nenhum

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:470 (description do efeito master) e 146-151 (KPI) · marts.v_saude_organizacao`
- **Categoria:** regua-nao-declarada
- **Evidência:** A view `marts.v_saude_organizacao` faz `coalesce(ma.master_ativo, false)`, e o CTE `master_ativo` só cobre `where o_1.master_user_id is not null`. Medi: `select v.master_ativo, count(*), count(*) filter (where o.master_user_id is null) from marts.v_saude_organizacao v join marts.dim_organizacao o on o.id=v.id where v.ativa and v.membros >= 2 group by 1` → master_ativo=true: 585 orgs, 0 sem master; master_ativo=false: **714 orgs, 13 sem master_user_id**. Na base do KPI (ativa e membros>0) são 16 de 1.925 (0,83%). O motor de achados declara isso num comentário SQL ('mistura master sem evento com organização que não tem master_user_id definido, dezesseis das ativas hoje') — confirmei o 16 — mas a tela não: nem a `description` do card "O master engajado puxa o time?", nem o rótulo do KPI "Orgs com master ativo".
- **Conserto proposto:** Acrescentar a cláusula na `description` do card: '· 13 contas não têm master cadastrado e caem em "Master parado"' — com o número saindo da RPC (uma coluna `sem_master` como `bi_orgs_ocupacao` já faz com `orgs_sem_limite`), nunca escrito à mão. Alternativa mais limpa: a RPC exclui `master_user_id is null` do agrupamento e devolve a contagem excluída, no mesmo padrão do `fora_sem_historico` de `bi_orgs_quem_parou_primeiro`.

### Observação · A régua e_cliente não é aplicada na leitura do MASTER — em dois lugares, CTE por CTE

- **Onde:** `marts.v_saude_organizacao (CTE master_ativo) · public.bi_orgs_quem_parou_primeiro (CTEs ult e org)`
- **Categoria:** outro
- **Evidência:** Li os corpos bloco a bloco. (1) `marts.v_saude_organizacao`: os CTEs `membros` e `ativos` juntam `dim_usuario ... and u.e_cliente`, mas o CTE `master_ativo` faz `exists (select 1 from marts.fact_evento f where f.user_id = o_1.master_user_id ...)` sem a régua. (2) `bi_orgs_quem_parou_primeiro`: o CTE `ult` lê `marts.fact_evento` agrupado por user_id sem régua; `time_por_org` corrige com `u.e_cliente`, mas o CTE `org` faz `left join ult lm on lm.user_id = o.master_user_id` — o master entra sem a régua. Medi o tamanho: 4 orgs ativas têm master fora da régua (3 com `e_cliente = false`, 1 ausente da dim), com 140 eventos. Impacto hoje: **0** em master_ativo (`contam_como_master_ativo = 0`) e, recomputando `bi_orgs_quem_parou_primeiro` inteira com `e_cliente` no `ult`, só `fora_sem_historico` muda de 577 para 578 — os três percentuais (70,5% / 16,7% / 12,8%) e o `base_com_historico` 485 ficam idênticos. É a régua ausente, não o número errado — mas é exatamente a forma do defeito de `bi_ia_adocao` (nome da régua presente no corpo, faltando num CTE).
- **Conserto proposto:** No `ult`, juntar `marts.dim_usuario du on du.user_id = f.user_id and du.e_cliente` (foi assim que recomputei). Na view, o CTE `master_ativo` ganha `join marts.dim_usuario mu on mu.user_id = o_1.master_user_id and mu.e_cliente`. Como o resultado não muda hoje, dá para conferir com md5 antes/depois, no padrão que a migration 20260818050000 usou. Se a decisão for não filtrar (o master é o comprador e talvez deva contar mesmo fora da régua), então precisa virar exceção declarada em `comment on function`, como já se faz em `bi_saude_rastreio`.

### Observação · A coluna "Master" usa Badge em vez de StatusPill, e fica sem ícone

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:289-291`
- **Categoria:** acessibilidade
- **Evidência:** `<Badge variant={r.master_ativo ? 'secondary' : 'outline'}>{r.master_ativo ? 'Ativo' : 'Parado'}</Badge>`. O CLAUDE.md manda 'Estado usa StatusPill, sempre com ícone e rótulo — nunca só cor', e o comentário do próprio `status-pill.tsx` diz que 'o ícone não é decorativo e não pode ser removido'. Grep confirma que só duas páginas usam Badge para estado (esta e `solucoes-page.tsx:276`), contra StatusPill em `clientes-page.tsx:440` e `visao-geral-page.tsx:437`. Aqui o rótulo textual existe, então não é falha de contraste — é a peça errada, e o degrau visual entre `secondary` e `outline` é o canal mais fraco da tela.
- **Conserto proposto:** `<StatusPill tom={r.master_ativo ? 'bom' : 'critico'}>{r.master_ativo ? 'Ativo' : 'Parado'}</StatusPill>` e remover o import de `Badge` (ele não é usado em nenhum outro ponto do arquivo).

### Observação · TabelaLonga num bloco de 3 linhas fixas, onde a regra manda <Table> cru

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:195-227`
- **Categoria:** densidade-ou-ordem
- **Evidência:** `bi_valor_nao_consumido` é um `union all` de três literais — a quantidade de linhas não vem do dado, é 3 para sempre. Rodei e voltaram 3 linhas. A regra do CLAUDE.md: 'Lista usa TabelaLonga ... vale para toda tabela cuja quantidade de linhas vem do dado' e 'fica em <Table> cru o que é bloco, não lista: ... comparação de 2–3 grupos nomeados'. Os outros quatro cards da tela seguem isso (distribuição, por tamanho, efeito master, quem parou primeiro usam <Table>). Visualmente hoje não aparece nada (a TabelaLonga esconde busca e paginação abaixo de uma página), mas a prop `rotuloBusca="Buscar benefício"` existe para uma busca que nunca vai ser renderizada.
- **Conserto proposto:** Trocar por `<Table>/<TableHeader>/<TableBody>` como nos outros quatro cards, e apagar `chave`, `buscarEm`, `rotuloBusca` e `vazio` junto.

### Observação · Três âncoras de card sem nenhuma regra apontando para elas

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:311, 369, 509`
- **Categoria:** codigo-morto
- **Evidência:** A tela declara `id="card-distribuicao-engajamento"` (:311), `id="card-orgs-por-tamanho"` (:369) e `id="card-quem-parou-primeiro"` (:509). No banco: `select id, ancora_aba, ancora_id from insights.regra where id like 'org_%'` → só três regras, apontando para `card-kpis` (org_time_ocioso e org_comprador_parado) e `card-efeito-master` (org_efeito_master). Os dois alvos existem na página (:122 e :466). Grep no repo inteiro (`src`, `supabase`, `docs`) pelos três ids acima: **as únicas ocorrências são as próprias declarações**. São âncoras sem link.
- **Conserto proposto:** Ou remover os três `id=`, ou — melhor, se a intenção era cobertura — as regras que hoje apontam para `card-kpis` passarem a apontar para o card que de fato desenha o número (org_time_ocioso fala de time ativo médio e o card "Onde estão as contas" é quem desenha a distribuição disso). Nesse caso a migration precisa purgar `insights.achado_cache` com `like 'organizacoes|%'`, porque a âncora vai serializada no cache.

### Observação · Coerção `?? 1` que nunca dispara dentro do reduce de maisDesperdicado

- **Onde:** `src/features/organizacoes/organizacoes-page.tsx:94-98`
- **Categoria:** codigo-morto
- **Evidência:** `const itens = (valor.data ?? []).filter((v) => v.pct_uso != null)` e, na linha seguinte, `itens.reduce((a, b) => ((b.pct_uso ?? 1) < (a.pct_uso ?? 1) ? b : a))`. O array já está filtrado por `pct_uso != null`, então os dois `?? 1` são inalcançáveis. Não é defeito de número (conferi: os três pct_uso vêm não nulos hoje — 0,0028 / 0,1385 / 0,0000, e o reduce escolhe corretamente 'Créditos de mentoria estratégica'), mas é a coerção de nulo que o projeto proíbe em valor exibido, deixada como enfeite defensivo no caminho de um headline.
- **Conserto proposto:** `itens.reduce((a, b) => (b.pct_uso! < a.pct_uso! ? b : a))` — ou, sem non-null assertion, tipar o filtro como type guard (`.filter((v): v is typeof v & { pct_uso: number } => v.pct_uso != null)`), que é o que o TypeScript strict pede e elimina os dois `??`.

---

## jornada — 16 achados (2 de risco alto)

### Risco alto · O `sessao_id` do mart colide entre reconstruções, e os três cards sem período contam sessões que não existem

- **Onde:** `src/features/jornada/jornada-page.tsx:194-249, 478-531, 535-583 (fonte: etl.sync_fact_navegacao no banco)`
- **Categoria:** numero-errado
- **Evidência:** `etl.sync_fact_navegacao` (lido com pg_get_functiondef) faz `delete from marts.fact_navegacao where data_brt >= now()-45` e reinsere só essa fatia, com `sessao_id = user_id || '-' || sum(nova) over (partition by user_id order by criado_em)`. O contador RECOMEÇA do zero a cada reconstrução, então o id de uma sessão antiga (fora dos 45 dias, que nunca é apagada) é reusado por uma sessão nova. Medido no banco: `select count(distinct sessao_id), count(*) filter (where ordem_na_sessao=1) from marts.fact_navegacao` → 59.854 sessões distintas contra 61.464 linhas de 'primeira tela'; 1.402 ids carregam duas sessões reais (1.206 deles atravessam o corte de 45 dias). Exemplo literal: o id `005957fa-2ca0-4ae5-a360-ebf3c925499f-1` tem ordem 1 e 2 em 03/07 (telas_na_sessao=9) E ordem 1 e 2 em 06/07 (telas_na_sessao=4). Impacto medido nos cards: (a) 'Quem chega por link direto não navega' imprime 13.970 + 47.494 = 61.464 sessões — 1.610 a mais do que existem; deduplicando por `distinct on (sessao_id)` a taxa cai de 40,21% para 40,70% e as sessões de 47.494 para 46.226. (b) 'Navegar fundo prediz seguir ativo' lê a janela 03/07–09/07, que ATRAVESSA o corte: 1.089 ids colididos e 9.123 linhas ali dentro; recomputando com chave corrigida (`sessao_id||'#'||corrida de ordem=1`), 116 dos 2.398 clientes (4,8%) trocam de grupo e o resultado publicado 54,84% × 43,27% (11,6 pp) vira 54,09% × 45,10% (9,0 pp) — 22% do efeito, contra margem declarada de 4,1 pp. (c) 'As sessões que inflam o ranking' soma `max(telas_na_sessao)` por id: 420.842 contra 428.102 linhas reais de navegação, então o denominador de '% das telas' não é o pageview que a seção diz ser. Os cards de 30 dias NÃO são afetados: a janela inteira cai dentro da última reconstrução.
- **Conserto proposto:** Tornar o `sessao_id` estável entre reconstruções: em `etl.sync_fact_navegacao`, trocar o contador por algo derivado do próprio início da sessão — `user_id || '-' || extract(epoch from first_value(criado_em) over (partition by user_id, bloco order by criado_em))::bigint` — para que o id de uma sessão nunca dependa de onde a fatia começou. Enquanto isso não acontece, as três RPCs sem período (`bi_jornada_porta_de_entrada`, `bi_jornada_profundidade_e_retencao`, `bi_jornada_sessoes_infladas`) precisam desempatar por corrida de `ordem_na_sessao = 1` em vez de tratar `sessao_id` como chave única. Depois: `delete from insights.achado_cache where chave like 'jornada|%'`.

### Risco alto · 'Onde a sessão morre' desenha um ranking por TAXA sobre uma lista cortada por VOLUME

- **Onde:** `src/features/jornada/jornada-page.tsx:113-117 e 410-441`
- **Categoria:** numero-errado
- **Evidência:** A página chama `bi_pontos_saida(p_dias, 10)` (queries.ts:46) e reordena o resultado por `pct_da_tela` (jornada-page.tsx:113-117), liderando o headline pela primeira linha dessa nova ordem. Mas a RPC (pg_get_functiondef) faz `order by 2 desc limit p_limite`, onde a coluna 2 é `count(*) filter (where proxima_tela is null)` — ou seja, o corte é por VOLUME de encerramentos. Rodando `bi_pontos_saida(30,10)` e comparando com a mesma consulta ordenada por taxa: o card desenha barras de 7,56% (/formacoes/:slug) e 8,53% (/solucoes) enquanto DEIXA DE FORA /mentoria-room/:id (28,85%, 463 saídas), /onboarding (18,76%, 638 saídas) e /mentorias-v2 (14,86%) — as 2ª, 4ª e 7ª maiores taxas do produto, todas passando o mesmo `having count(*) >= 100`. São 32 telas elegíveis no período e o card mostra 10, escolhidas por outro critério. Hoje o headline (29,6% de /team-management) acerta o topo por coincidência: /mentoria-room/:id está 0,76 pp atrás e fora da lista, então basta uma virada para o card afirmar como líder quem não é. Isto é exatamente o que o CLAUDE.md proíbe: 'RPC com p_limite só permite liderar pela primeira linha (a ordenação garante)'.
- **Conserto proposto:** Fazer a RPC cortar pelo mesmo critério com que a tela ordena: `order by 3 desc` (pct_da_tela) em `bi_pontos_saida`, ou um parâmetro de ordenação explícito. O motor usa `sai_topo` (maior taxa) e `sai_1` (maior volume) do mesmo conjunto, então o `sai_1` de `insights.calcular_achados_jornada` precisa ser revisto junto — e a migration termina com `delete from insights.achado_cache where chave like 'jornada|%'`. Enquanto a ordem não mudar, a `description` do card tem de dizer que a lista é 'as dez telas que mais encerram sessão em volume, ordenadas por taxa'.

### Atenção · A régua escrita de 'Onde a sessão morre' declara um limiar que não é o do SQL

- **Onde:** `src/features/jornada/jornada-page.tsx:421 e 647`
- **Categoria:** regua-nao-declarada
- **Evidência:** A `description` diz 'sessões com 2+ telas, telas com 100+ encerramentos' (jornada-page.tsx:421) e a fonte da AbaDeDados repete 'telas com 100+ encerramentos' (linha 647). O corpo de `bi_pontos_saida` é `having count(*) >= 100` — `count(*)` são as VISITAS da tela (linhas com telas_na_sessao > 1), não os encerramentos, que são `count(*) filter (where proxima_tela is null)`. Prova rodada no banco: /solution/:id passa o `having` com 160 visitas e apenas 22 encerramentos. O comentário do próprio código (linha 433) cita a cláusula certa — só o texto que vai para a tela está errado. O erro fica load-bearing assim que a ordenação do achado anterior for corrigida, porque telas de baixo volume passam a poder subir.
- **Conserto proposto:** Trocar por 'telas com 100+ visitas no período' nos dois lugares.

### Atenção · 'Posição média' publica 66,7 numa tela cujo KPI diz que a sessão mediana tem 3,0 telas

- **Onde:** `src/features/jornada/jornada-page.tsx:211 e 304-306`
- **Categoria:** numero-errado
- **Evidência:** `bi_raio_x_telas` devolve `round(avg(n.ordem_na_sessao),1)` e a célula imprime 66,7 para /learning/course/:id/lesson/:id (jornada-page.tsx:304-306), a dois blocos do KPI 'Telas por sessão (mediana) = 3,0' (bi_jornada_kpis(30) → telas_medianas 3.0). Medido no banco para essa tela nos 30 dias: média 66,7 · MEDIANA da posição 9 · média excluindo as sessões de 200+ telas 13,2 — 3.632 das 53.959 visitas (6,7%) vêm dessas sessões e multiplicam a coluna por 5. Pior: a `description` do card que existe para denunciar essa contaminação lista 'o ranking de pageview, as telas por sessão e a duração mediana' (linha 211) — e 'duração mediana' NÃO EXISTE em nenhuma RPC nem em nenhum card desta tela (grep por 'dura' no diretório: só essa string), enquanto a métrica que é 5× contaminada, a posição média, ficou fora da lista.
- **Conserto proposto:** Trocar `avg(ordem_na_sessao)` por `percentile_cont(0.5)` em `bi_raio_x_telas` (o rótulo passa a ser 'Posição típica'), que é a mesma escolha já feita em `bi_jornada_kpis`; e na descrição do card de sessões infladas trocar 'a duração mediana' por 'a posição média do raio-x', que é o que de fato quebra.

### Atenção · O headline do card de destaque casa a faixa por prefixo de string, e o `?? 0` publicaria 100,0% em silêncio

- **Onde:** `src/features/jornada/jornada-page.tsx:120-126`
- **Categoria:** numero-errado
- **Evidência:** `const umaTela = faixas.find((p) => p.faixa.startsWith('1'))?.sessoes ?? 0` (jornada-page.tsx:124). As faixas devolvidas por `bi_profundidade_sessao(30)` são '1 tela', '2–3 telas', '4–7 telas', '8–15 telas', '16+ telas' — `startsWith('1')` casa com DUAS delas ('1 tela' e '16+ telas'). Hoje o número sai certo só porque a RPC tem `order by ordem` e '1 tela' vem primeiro no array; a RPC devolve a coluna `ordem` (=1) que seria a chave robusta e a página a ignora, embora use `f.ordem === 4` no card irmão (linha 87). E o `?? 0` fecha o caso: se o rótulo mudar no SQL, `umaTela` vira 0, `exploram` vira 1 e o card de destaque publica '100,0% das sessões passam de uma tela' sem erro nenhum. Conferido: hoje 39.872 sessões, 12.613 de uma tela → 68,4%, que bate com 1 − 0,3163 do KPI.
- **Conserto proposto:** `faixas.find((p) => p.ordem === 1)` e, no lugar do `?? 0`, devolver `null` quando a faixa não for encontrada — headline '—' é honesto, 100% não.

### Atenção · 'Quem chega por link direto não navega' não diz de que janela fala, e publica 61.464 sessões ao lado de um KPI que diz 39.872

- **Onde:** `src/features/jornada/jornada-page.tsx:493-497`
- **Categoria:** regua-nao-declarada
- **Evidência:** `bi_jornada_porta_de_entrada()` devolve `janela_inicio`/`janela_fim` (rodada: 2026-07-03 a 2026-08-19) e a página não usa nenhum dos dois. A `description` (jornada-page.tsx:493-497) só traz a definição de porta da frente, a margem e o confundidor. O card irmão da MESMA seção usa os campos equivalentes e escreve as datas (linha 550). Resultado na tela: a tabela imprime 13.970 + 47.494 = 61.464 sessões enquanto o KPI 'Sessões' no topo, com o seletor em 30 dias, mostra 39.872 — 1,5× de diferença sem uma linha explicando que são janelas diferentes. A prosa da seção diz apenas 'os dois recortes comparativos leem janelas fixas do histórico', sem data.
- **Conserto proposto:** Incluir `Janela de ${formatDateShort(linkDireto.janela_inicio)} a ${formatDateShort(linkDireto.janela_fim)}` na description, como o card de profundidade × retenção já faz.

### Atenção · 'Como navegou na 1ª semana' é a primeira semana do ARQUIVO, não a do cliente — e 86% deles já existiam antes dela

- **Onde:** `src/features/jornada/jornada-page.tsx:562 e 676`
- **Categoria:** regua-nao-declarada
- **Evidência:** `bi_jornada_profundidade_e_retencao` define a janela como `min(data_brt), min(data_brt)+6` de `marts.fact_navegacao`, ou seja 03/07 a 09/07/2026 — o começo do espelho, não o começo de vida de ninguém. Medido: dos 2.398 clientes que a função agrupa, 2.063 (86%) foram criados ANTES de 03/07/2026, o mais antigo em 14/01/2025. O cabeçalho da coluna diz 'Como navegou na 1ª semana' (linha 562) e a fonte da AbaDeDados diz 'navegação na primeira semana' (linha 676); a leitura natural — coorte, primeira semana do cliente — está errada para 86% das linhas. A `description` do card salva parcialmente porque imprime as datas, mas o rótulo visível continua afirmando outra coisa.
- **Conserto proposto:** Trocar o cabeçalho por 'Como navegou em 03–09/07' (ou 'na semana mais antiga do arquivo') e a descrição da fonte por 'primeira semana registrada no espelho de navegação — não é a primeira semana de cada cliente'.

### Atenção · A identidade de cada linha da tela é uma rota crua com placeholders, em fonte monoespaçada

- **Onde:** `src/features/jornada/jornada-page.tsx:266, 292, 328-332, 362, 388, 399-401, 419, 431-433`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** `className="font-mono text-xs"` nas células de tela e destino (linhas 292 e 362); rota crua nos rótulos das barras dos dois gráficos (399-401 e 431-433); nas opções do seletor (328-332); e em TRÊS headlineLabels que são o texto grande do card: 'pageviews na líder (/learning/course/:id/lesson/:id)' (266), 'sessões abrem em /learning/course/:id/lesson/:id' (388) e 'das visitas a /team-management terminam ali' (419). Os valores reais rodados no banco incluem `/learning/course/:id/lesson/:id`, `/solucoes/:slug`, `/ferramentas/builder-v2/:sub`, `/mentoria-room/:id` — padrão de rota com `:id`/`:slug`, que é saída de roteador, não nome de tela. São 86 telas distintas em 30 dias e 32 acima do piso de 100 visitas, então um mapa de nomes cobre a tela inteira com poucas dezenas de entradas.
- **Conserto proposto:** Um mapa rota→nome em pt-BR em `src/lib/` (ou uma coluna `nome` em `marts`), aplicado nos rótulos, headlines e no seletor, com a rota crua ficando visível só na AbaDeDados, onde o cru é o objetivo declarado. Tirar o `font-mono` das células de conteúdo.

### Atenção · O único card `prescritivo` da tela é uma tabela de distribuição sem ação e sem lista acionável

- **Onde:** `src/features/jornada/jornada-page.tsx:195`
- **Categoria:** nivel-desonesto
- **Evidência:** `nivel="prescritivo"` em 'As sessões que inflam o ranking' (linha 195). `DEFINICAO.prescritivo` em src/lib/escada.ts exige 'lista acionável, ou ação com o número que a justifica'; o card desenha quatro faixas de tamanho de sessão com sessões/telas/percentuais e a `description` termina numa CONSEQUÊNCIA ('enquanto essas sessões contarem, o ranking ... estão contaminados'), não numa ação, e não nomeia ninguém — as 18 pessoas por trás das 40 sessões vêm na coluna `pessoas` da RPC e nem são desenhadas. Pelo próprio arquivo ele é `diagnostico` ('onde, ou por quê'). O sinal de que o rótulo foi escolhido para passar na régua: é o ÚNICO prescritivo da tela, e sem ele `escada.test.ts` reprovaria por `prescritivosNoMinimo`. (Não estou pedindo a remoção do card — ele é o que prova os outros números e está aguardando decisão; o defeito é o degrau declarado.)
- **Conserto proposto:** Ou o card ganha a ação e o quem (as 18 pessoas com sessão de 200+ telas, com o pedido de excluí-las do ranking), ou ele passa a `diagnostico` e a tela ganha um prescritivo de verdade — o candidato natural é 'Onde a sessão morre' virando lista de telas a corrigir com o número que justifica.

### Atenção · O achado `jor_espelho_sessao` publica '16,7% do total' e nenhum card desenha esse percentual

- **Onde:** `src/features/jornada/jornada-page.tsx:396-405 (insights.regra jor_espelho_sessao)`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** O gabarito em `insights.regra` é '... Ela abre {sessoes_abertas:int} sessões, {pct_entrada:pct} do total, e encerra outras {saidas:int}', ancorado em `card-portas-entrada`. `pct_entrada` sai de `bi_portas_entrada(30,10).pct` = 0,1666 → '16,7%'. O card 'Portas de entrada' desenha `data={... ({category: e.tela, value: e.sessoes})}` (linhas 399-402): só sessões absolutas, sem `nota` e sem coluna de percentual. A regra não está suprimida hoje (conferido: ent_1 = sai_1 = rx_volume = /learning/course/:id/lesson/:id, pct 0,1666 ≥ 0,10 e ≥ 1,5× os 0,0996 da segunda), então a frase está publicada. Quem clica em 'ver o gráfico que sustenta' cai num gráfico onde 16,7% não aparece. Os outros dois números da frase existem: 6.644 no headline e 6.993 na `nota` do card de saída.
- **Conserto proposto:** Levar o percentual ao card, que é o caminho que o CLAUDE.md prefere: `nota: formatPercent(e.pct)` no dado do CategoryBarChart de portas de entrada (mesmo canal já usado no card de saídas). Alternativa: tirar `{pct_entrada:pct}` do gabarito e purgar o cache de jornada.

### Observação · A fonte `bi_fluxo_da_tela` na AbaDeDados não declara o corte de dez linhas que o SQL tem chumbado

- **Onde:** `src/features/jornada/jornada-page.tsx:624-632`
- **Categoria:** regua-nao-declarada
- **Evidência:** `bi_fluxo_da_tela` termina em `limit 10` fixo (pg_get_functiondef) e a chamada não passa teto. O card declara com `limiteDaFonte={10}` (linha 351), mas a entrada correspondente da AbaDeDados (linhas 624-632) não traz o campo `limite`, embora as fontes vizinhas de `bi_raio_x_telas`, `bi_portas_entrada` e `bi_pontos_saida` tragam. O próprio `aba-de-dados.tsx` declara a regra: 'O corte é declarado quando a RPC tem teto, pela limiteDaFonte da TabelaLonga: sem isso "não achei na busca" lê como "não existe"'. Conferido nos dados: para /solucoes as dez linhas somam 95,6% e 4,4% ficam fora.
- **Conserto proposto:** Acrescentar `limite: 10` à fonte de `bi_fluxo_da_tela`.

### Observação · 'Para onde vão a partir de uma tela' é o único card de conteúdo da tela sem régua nenhuma

- **Onde:** `src/features/jornada/jornada-page.tsx:314-340`
- **Categoria:** regua-nao-declarada
- **Evidência:** O card passa `action` (o seletor) e nenhuma `description` (linhas 314-340). Em `card-cabecalho.tsx` o slot é `action ?? description`, então mesmo que uma descrição fosse escrita ela seria descartada — o card fica sem botão de informação e sem uma linha de régua. É um card `nivel="diagnostico"`, e `DEFINICAO.diagnostico` em escada.ts exige 'taxa com denominador correto e ao menos um confundidor declarado': não há confundidor declarado em lugar nenhum do card. Também não há onde dizer que o `% do total` é sobre TODAS as transições da tela (o `sum() over ()` da RPC é anterior ao `limit 10`), e não só sobre as dez desenhadas.
- **Conserto proposto:** Mover o seletor para o cabeçalho da `SecaoDeAnalise` (que aceita controle de seção) e devolver a `description` ao card — ou estender `CardCabecalho` para aceitar `action` e `description` juntas, já que hoje uma engole a outra em silêncio.

### Observação · Em 11 das 86 telas selecionáveis o headline afirma que as sessões 'vão para (fim da sessão)'

- **Onde:** `src/features/jornada/jornada-page.tsx:318-319`
- **Categoria:** outro
- **Evidência:** `bi_fluxo_da_tela` monta `coalesce(n.proxima_tela, '(fim da sessão)')` como destino, e a página lê a primeira linha para escrever ``vão para ${destinoLider.destino}`` (linha 319). Rodando o fluxo para as 86 telas do raio-x nos 30 dias, em 11 delas o maior destino é '(fim da sessão)' — nessas, o card diz 'X% vão para (fim da sessão)', que é ir para a ausência de destino. Para o padrão /solucoes o rótulo sai certo ('49,7% vão para /solucoes/:slug'), então o defeito só aparece ao trocar a tela no seletor.
- **Conserto proposto:** Ramificar o headlineLabel: quando `destinoLider.destino === '(fim da sessão)'`, escrever 'encerram a sessão ali' em vez de 'vão para …'.

### Observação · O seletor de tela não tem nome acessível

- **Onde:** `src/features/jornada/jornada-page.tsx:324`
- **Categoria:** acessibilidade
- **Evidência:** `<SelectTrigger className="w-full sm:w-64">` (linha 324) sem `aria-label`. O único texto do gatilho é o valor selecionado ('/solucoes'), então o leitor de tela anuncia 'combobox /solucoes' sem dizer o que ele controla. O padrão da própria casa está em `src/components/filters/segmento-filtro.tsx:31-33`, que passa `aria-label={`Filtrar por ${rotulo.toLowerCase()}`}` — é o único outro `SelectTrigger` de produto do repositório.
- **Conserto proposto:** `aria-label="Escolher a tela de origem do fluxo"` no SelectTrigger.

### Observação · O headline do card de destaque é o complemento exato do KPI do topo, calculado no front a partir de outra RPC

- **Onde:** `src/features/jornada/jornada-page.tsx:120-126, 162-168, 456-457`
- **Categoria:** outro
- **Evidência:** KPI 'Sessões de tela única' = `bi_jornada_kpis(30).pct_uma_tela` = 0,3163 → 31,6% (linhas 162-168). Headline de 'Profundidade das sessões' = `(total − umaTela)/total` somado no front sobre `bi_profundidade_sessao(30)` (linhas 120-126) = (39.872 − 12.613)/39.872 = 68,4% (linhas 456-457). São o mesmo fato dito duas vezes, invertido, a partir de duas funções diferentes. Hoje não divergem — conferido: as duas leem `marts.fact_navegacao` na mesma janela e agrupam por `sessao_id` com `max(telas_na_sessao)`, e 12.613+9.402+8.269+5.880+3.708 = 39.872 bate com o `sessoes` do KPI.
- **Conserto proposto:** Trocar o headline por um número que o KPI não dá — por exemplo a fatia de sessões com 8+ telas, ou a mediana de telas por sessão da faixa líder — ou tirar o KPI 'Sessões de tela única' do topo, já que o card desenha a distribuição inteira.

### Observação · `bi_jornada_kpis` é a única das nove RPCs da tela fora do padrão de `(select marts.data_referencia())`

- **Onde:** `public.bi_jornada_kpis (banco) — consumida em src/features/jornada/queries.ts:11`
- **Categoria:** outro
- **Evidência:** O corpo tem `where data_brt > marts.data_referencia() - p_dias`, sem o `(select …)`; as outras oito RPCs desta tela (raio_x, fluxo, portas_entrada, pontos_saida, profundidade_sessao e as três sem período) usam a forma com subselect. O CLAUDE.md fixa o padrão: '(select marts.data_referencia()) no filtro inline (vira InitPlan, avaliado uma vez)'. Medido com EXPLAIN ANALYZE sobre a mesma consulta: forma atual → Index Scan com `Index Cond: (data_brt > (marts.data_referencia() - 30))`, 210,5 ms; com o subselect → InitPlan 1 + Bitmap Heap Scan, 186,1 ms.
- **Conserto proposto:** Migration trocando por `where data_brt > (select marts.data_referencia()) - p_dias`, no mesmo formato das outras vinte e uma funções já migradas.

---

## receita — 11 achados (4 de risco alto)

### Risco alto · O headline de "Saúde da cobrança" publica 100,0% em "Pagamento aprovado" — o denominador comparado consigo mesmo

- **Onde:** `src/features/receita/receita-page.tsx:65-69 e 223-232`
- **Categoria:** numero-errado
- **Evidência:** SQL rodado: `select * from public.bi_receita_saude_cobranca()` devolve 4 linhas — Pagamento aprovado (236 faturas · R$ 626.535,44 · pct_do_pago = 1.0000), Pagamento falhou (131 · R$ 496.737,92 · 0.7928), Reembolsado (33 · R$ 112.250,48 · 0.1792), Fatura expirou (7 · R$ 33.482,00 · 0.0534). O código (linhas 65-69) é `evs.reduce((a, b) => ((b.pct_do_pago ?? 0) > (a.pct_do_pago ?? 0) ? b : a))` sobre TODAS as linhas com pct != null — o máximo é 1.0000, que é a linha 'Pagamento aprovado'. `pct_do_pago` chega como `number` (database.types.ts:981), então a comparação é numérica e o resultado é determinístico. A tela renderiza headline "100,0%" com headlineLabel "do valor pago em Pagamento aprovado" (linhas 223-232), enquanto o comentário da linha 64 declara: "O card de cobrança é sobre dinheiro que não entrou: lidera pelo pior evento". O pior evento real é 'Pagamento falhou', 79,3%. O headline é 626.535,44 / 626.535,44 — uma tautologia impressa como número de destaque.
- **Conserto proposto:** Excluir a linha do aprovado do reduce: ela é o denominador, não um desfecho de cobrança. O filtro por rótulo é frágil — `insights.calcular_achados_receita` já registra a mesma armadilha em comentário ("o conserto definitivo é a RPC devolver a chave crua ao lado do rótulo"). Fazer isso: `bi_receita_saude_cobranca` passa a devolver `tipo` cru ao lado de `evento`, o motor e a página filtram por `tipo <> 'invoice.payment_succeeded'`. De quebra some a duplicação com os KPIs (mesmo 236 e mesmo R$ 626.535,44 publicados duas vezes na tela, vindos de duas RPCs).

### Risco alto · A tela publica duas receitas e dois "compradores" — o topo conta faturas sem dono, os cards de baixo só clientes — e não diz

- **Onde:** `src/features/receita/receita-page.tsx:112-139 (KPIs) contra 274-328 e 332-378 (tabelas)`
- **Categoria:** regua-nao-declarada
- **Evidência:** Medido: KPI "Receita reconhecida" = R$ 626.535,44 e KPI "Compradores" = 103 (`bi_receita_kpis`, `count(distinct email)` sobre `marts.fact_fatura` sem régua `e_cliente`). SQL rodado sobre as 236 faturas pagas: `count(distinct user_id)` = 79, **49 faturas com `user_id is null`**, compradores com `e_cliente` = 78, receita com `e_cliente` = **R$ 481.857,41**. A coluna "Receita" de `bi_ltv_cohort` soma exatamente R$ 481.857,41 (1.189,80 + 4.914,00 + 82.250,36 + 286.860,51 + 106.642,74) e a coluna "Compradores" soma 78 (1+1+11+54+11); `bi_uso_vs_receita` soma 78 clientes (47+5+26). Ou seja: na mesma tela, receita = R$ 626.535,44 no topo e R$ 481.857,41 na tabela (diferença de R$ 144.678,03, 23,1%), e compradores = 103 no topo contra 78 nas duas tabelas (32% a mais). A ausência de `e_cliente` nas três RPCs de topo É exceção declarada em `comment on function` ("283 das 1.119 linhas não têm user_id... grão é a fatura, não a pessoa") — o defeito não é o SQL, é a tela não declarar que as duas metades contam universos diferentes.
- **Conserto proposto:** Declarar na tela, não no banco: (a) `description` dos cards de safra e de faixa passa a dizer que contam só clientes identificados; (b) o rótulo do KPI "Compradores" vira algo que não colida com a coluna "Compradores" da tabela (é contagem por e-mail, no grão da fatura — 49 das 236 faturas pagas não têm pessoa associada). Melhor ainda: a `regua` de `nav-items.ts` já fala em "faturas deduplicadas"; acrescentar a cláusula do grão ("faturas sem cliente identificado entram no total e ficam fora dos recortes por pessoa").

### Risco alto · "Receita por safra de entrada" mostra 5 de 16 safras e a tela não declara o corte

- **Onde:** `src/features/receita/receita-page.tsx:287 e 293-327`
- **Categoria:** regua-nao-declarada
- **Evidência:** `pg_get_functiondef(bi_ltv_cohort)` tem duas cláusulas de corte não declaradas: `where u.e_cliente and u.cohort_mes >= date '2025-05-01'` e `having count(r.user_id) > 0`. SQL rodado: `select count(distinct cohort_mes) from marts.dim_usuario where e_cliente and cohort_mes >= '2025-05-01'` = **16 safras**; a RPC devolve **5**. Recomputando a agregação sem o `having`, as 11 safras omitidas somam **11.023 clientes** — 73% dos 15.041 do recorte — e todas têm ZERO compradores: ago/2026 (1.109), jul/2026 (1.666), jun/2026 (1.773), mai/2026 (1.817), abr/2026 (2.032), fev/2026 (1.010), jan/2026 (866), dez/2025 (736), jul/2025 (2), jun/2025 (2), mai/2025 (10). Isto é, o corte esconde exatamente a notícia (nenhuma safra desde nov/2025 tem mais de 1 comprador). A `TabelaLonga` é montada sem `limiteDaFonte` (linhas 293-327) e a `description` diz "receita por cliente considera toda a safra, inclusive quem nunca comprou" (linha 287), o que sugere completude.
- **Conserto proposto:** Duas opções, e a segunda é melhor: (1) declarar o corte na `description` ("safras sem nenhum comprador ficam de fora — hoje 11 das 16"); (2) tirar o `having count(r.user_id) > 0` da RPC e deixar as safras de receita zero aparecerem, que é a leitura que o card promete. O piso `cohort_mes >= '2025-05-01'` custa 4 clientes em 2 safras (medido) e é literal chumbado em SQL — ou vira parâmetro, ou entra na régua escrita.

### Risco alto · A prosa da seção 2 afirma "Falha é dinheiro que nunca entrou", e 31 das 131 faturas que falharam foram pagas depois

- **Onde:** `src/features/receita/receita-page.tsx:216`
- **Categoria:** numero-errado
- **Evidência:** SQL rodado sobre `marts.fact_fatura`: dos 131 `fatura_id` distintos com `invoice.payment_failed`, **31 (23,7%) também têm `invoice.payment_succeeded`**, somando **R$ 64.164,89** — 12,9% dos R$ 496.737,92 que a tabela publica como falha. A mesma consulta mostra que a segunda metade da frase também não se sustenta: das 33 faturas `invoice.refunded`, **10 (R$ 47.057,34) não têm nenhuma linha de pagamento aprovado no mart**, então "dinheiro que entrou e voltou" é indemonstrável para 30% dos reembolsos. A frase inteira é: "Falha é dinheiro que nunca entrou; reembolso é dinheiro que entrou e voltou, e só os dois juntos explicam a distância entre o cobrado e o reconhecido". O achado `rec_falha_cobranca` do motor herda o mesmo viés (publica os 79,3% como "a cobrança insiste mais do que acerta").
- **Conserto proposto:** A frase tem de virar a régua verdadeira: falha é TENTATIVA que falhou, e a mesma fatura pode aparecer nas duas linhas. Duas saídas — reescrever a prosa ("tentativa de cobrança que falhou; 31 destas faturas foram pagas depois") ou, melhor, a RPC passar a devolver a falha LÍQUIDA (fatura que falhou e nunca sucedeu), que é o número que responde a pergunta do card. Se mudar a RPC, purgar `insights.achado_cache where chave like 'receita|%'` — `rec_falha_cobranca` e `rec_reembolso` leem essa função.

### Atenção · A prosa da seção 3 diz que os dois cards "recortam a mesma base", e as duas colunas "Clientes" diferem 51×

- **Onde:** `src/features/receita/receita-page.tsx:271`
- **Categoria:** numero-errado
- **Evidência:** A frase (linha 271) é: "Os dois recortam a mesma base por chaves diferentes — mês de entrada e faixa de receita — e mostram média por grupo, então a coluna de clientes é o que diz se a média se sustenta". Medido nas duas RPCs rodadas com os argumentos da página: a coluna "Clientes" de `bi_ltv_cohort` soma **4.018** (2.146+531+455+521+365 — todo `e_cliente` da safra, comprador ou não), e a coluna "Clientes" de `bi_uso_vs_receita` soma **78** (47+5+26 — só quem tem receita > 0, porque as faixas nascem do CTE `receita`). Mesmo rótulo de coluna, dois universos, lado a lado na mesma seção, com a prosa afirmando que a base é comum — e a frase ainda manda o leitor usar justamente essa coluna como aferidor da média.
- **Conserto proposto:** Trocar a afirmação de base comum por uma de base diferente, que é a informação útil: um card divide TODOS os clientes da safra (o denominador inclui quem nunca comprou), o outro só os que compraram. Enquanto a prosa não for corrigida, renomear a coluna do card de faixas para "Compradores" já remove metade da colisão.

### Atenção · Data chumbada 'abr/2026' no aviso de limitação, e a data real é impressa sem ano

- **Onde:** `src/features/receita/receita-page.tsx:96`
- **Categoria:** numero-que-nao-existe-na-tela
- **Evidência:** Linha 96: `{dadosAte ? formatDateShort(dadosAte) : 'abr/2026'}`. O `Card` de aviso é renderizado sem nenhuma guarda de `kpis.isLoading`/`isError` (linhas 90-107), então durante o carregamento — e permanentemente se `bi_receita_kpis` falhar — a tela afirma "O último webhook de pagamento recebido pela plataforma é de abr/2026" a partir de um literal, não do dado. Com o dado carregado (`bi_receita_kpis().dados_ate` = 2026-04-18, rodado) a frase lê "é de 18 de abr": `formatDateShort` (src/lib/format.ts:93-98) formata só `{ day: 'numeric', month: 'short' }` — sem ano, num aviso cuja única função é datar a parada da fonte. Os dois formatos ainda divergem entre si ("abr/2026" × "18 de abr").
- **Conserto proposto:** Tirar o literal: `{dadosAte ? formatDateShort(dadosAte) : '—'}`, ou não renderizar a frase enquanto `kpis.data` não chegar. E usar um formatador com ano (ou acrescentar um em `format.ts`) — numa tela cuja tese é "a fonte parou há quatro meses", a data sem ano é a informação principal pela metade.

### Atenção · Nenhum dos 5 cards declara `nivel=`, e a tela não tem card prescritivo

- **Onde:** `src/features/receita/receita-page.tsx:155-378 (os cinco cards)`
- **Categoria:** nivel-desonesto
- **Evidência:** Medido no fonte: `grep -c 'nivel="'` = **0** contra **5** `<ChartCard|TabelaCard>`. Nas outras oito telas de produto a cobertura é integral (visao-geral 7/7, clientes 10/10, entrada 6/6, formacoes 8/8, solucoes 7/7, ia 8/8, organizacoes 7/7, jornada 8/8); só receita e cs estão em zero. Receita não está em `TELAS_NA_REGUA` (src/lib/escada.test.ts:31-50) nem em `TELAS_NA_DENSIDADE` (src/lib/densidade.ts:232-240) — `npx vitest run src/lib/densidade.test.ts` passa 39/39 e só cobra o teto (`'features/receita/receita-page.tsx' não passa do teto de hoje`). Ou seja, nada reprova, mas `avaliarComposicao({descritivo:0, comparativo:0, diagnostico:0, prescritivo:0})` falharia em 3 das 4 regras, e a tela de fato não tem nenhum card que diga o que fazer sobre quem.
- **Conserto proposto:** Declarar os quatro `nivel` honestos primeiro (Receita por mês = descritivo; Compradores por mês = descritivo; Saúde da cobrança = diagnóstico; Receita por safra = comparativo; Quem paga mais usa mais? = comparativo) — isso já expõe o buraco: zero prescritivo. O prescritivo natural desta tela é a lista nominal das faturas que falharam e nunca foram pagas (100 faturas, R$ 432.573,03 medidos), que é quem contatar. Só entrar em `TELAS_NA_REGUA`/`TELAS_NA_DENSIDADE` depois disso.

### Atenção · As três prosas de seção passam do teto de 240, e a seção do meio tem um card só sem exceção declarada

- **Onde:** `src/features/receita/receita-page.tsx:152, 216, 271 (prosa) e 218 (seção órfã)`
- **Categoria:** densidade-ou-ordem
- **Evidência:** Medido no fonte com script: as três `descricao=` de `SecaoDeAnalise` têm **266, 291 e 318** caracteres, contra `REGUA_DE_DENSIDADE.prosaDeSecaoNoMaximo = 240` (densidade.ts:70) — as três estouram, a maior em 32%. `cardsPorSecao` = **[2, 1, 2]**: a seção "Quanto do dinheiro cobrado não ficou" tem um `BentoItem` só (linha 218), contra `cardsPorSecaoNoMinimo = 2`, e o fonte NÃO contém `DENSIDADE_DECLARADA:` (verificado — a busca por `MARCA_DE_EXCECAO` devolve false). Cards = 5 e `<TableHead>` = 14, que batem exatamente com `TETO_POR_TELA['features/receita/receita-page.tsx']` — esse eixo está no limite, não acima.
- **Conserto proposto:** Ao encurtar, achar o DESTINO de cada cláusula antes de cortar (a lição de 19/ago: encurtar prosa apaga régua) — o denominador "valor aprovado da série inteira" pertence à `description` do card de cobrança, não à seção. Para a seção órfã: ou funde com a seção 1 pela PERGUNTA ("quanto entrou e quanto não ficou"), ou ganha o segundo card — o prescritivo que falta (faturas que falharam e nunca foram pagas) é candidato natural e resolve as duas coisas.

### Atenção · Nome de view da plataforma em fonte monoespacada e diagnóstico de payload JSON no aviso do topo

- **Onde:** `src/features/receita/receita-page.tsx:99-104`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** Linhas 99-104: "A view de receita da plataforma está incorreta. A `<code>bi_receita_hubla</code>` lê um caminho de JSON que não existe no payload real, então retorna vazio. Aqui usamos o caminho correto — os dois números não vão bater." Conferi a afirmação no banco da plataforma (zotzvtepvpnkcoobdubt): a view existe, filtra `payload->'invoice'->>'status' = 'paid'`, `select count(*) from bi_receita_hubla` = **0**, `select count(*) from hubla_webhooks` = **3.533** e `count(*) where payload ? 'invoice'` = **0**. A afirmação é verdadeira — e é exatamente a classe de conteúdo que saiu da Entrada hoje (commit b2721b9): nome de objeto de banco, caminho de JSON e discrepância entre dois sistemas não é análise que o CEO faça. O vocabulário "webhook" aparece mais 4 vezes na tela (linhas 95, 152, 216, 271, 392).
- **Conserto proposto:** Manter o primeiro parágrafo do aviso ("a fonte parou", que é fato de negócio) e mover o segundo para o `comment on function` / doc de engenharia. Se o CEO precisar saber que outro relatório mostra número diferente, a frase é de negócio e sem nome de objeto: "outros relatórios da plataforma mostram receita diferente desta — esta é a apuração correta".

### Observação · `?? 0` sobrevivente no `data` do TimeSeriesChart, que escapa da régua do CI por causa do nome da chave

- **Onde:** `src/features/receita/receita-page.tsx:179`
- **Categoria:** numero-errado
- **Evidência:** Linha 179: `receita: m.receita_brl ?? 0` dentro do `.map` que monta o `data` da série de "Receita por mês". O `contrato-de-tela.test.ts` casa `value=\{[^}]*\?\?\s*0` e `value:\s*[^,}]*\?\?\s*0` (linhas 62-65) — chave `value`, e aqui a chave é o nome da série. Hoje o defeito é inalcançável: SQL rodado mostra `count(*) filter (where valor_brl is null)` = 0 nas 236 faturas pagas, e `bi_receita_mensal()` devolve 9 meses todos com valor. Mas `TimeSeriesPoint` é `Record<string, string | number>` (time-series-chart.tsx:24), então nada impede o mês nulo virar zero desenhado — a mesma "régua que casa uma grafia e não a classe de defeito" que o próprio teste documenta em comentário.
- **Conserto proposto:** Dois passos independentes: (a) na página, filtrar o mês nulo em vez de zerá-lo, como o `melhorMes` já faz na linha 59; (b) generalizar o regex do `contrato-de-tela.test.ts` para casar qualquer chave de objeto dentro de um `data={...map(...)}`, ou dar ao `TimeSeriesPoint` o mesmo `number | null` + `motivoSemValor` que o `CategoryDatum` ganhou hoje.

### Observação · Percentual e média sobre n=5 publicados sem supressão, e a janela de "Ativos em 30d" ancora 4 meses depois do fim da receita

- **Onde:** `src/features/receita/receita-page.tsx:341 e 355 (coluna "Ativos em 30d")`
- **Categoria:** regua-nao-declarada
- **Evidência:** `select * from public.bi_uso_vs_receita()` devolve 3 faixas, e a do meio é `R$ 3–6 mil / 5 clientes / receita_media 4.294,18 / dias_ativos_medio 0,2 / pct_ativos_30d 0,0000`. `pg_get_functiondef` confirma que não há `having count(*) >= N` nem case de supressão: os 0,0% saem de 0/5 e são impressos como número. A `description` do card diz apenas "amostra pequena em algumas faixas, leia com cautela" (linha 341) — não diz qual faixa nem quão pequena. Além disso, `ativo_30d` usa `(select marts.data_referencia()) - 30`, e `select marts.data_referencia()` = **2026-08-19** (rodado), quatro meses depois de `dados_ate` = 2026-04-18: a coluna "Ativos em 30d" mede julho/agosto de 2026 ao lado de uma receita que termina em abril. A prosa da seção declara a divergência de eixo dos *dias ativos*, não a dos 30 dias.
- **Conserto proposto:** Suprimir no banco, como manda a doutrina da casa: `bi_uso_vs_receita` devolve `null` em `pct_ativos_30d`/`dias_ativos_medio` abaixo do piso de amostra, e a célula imprime travessão com o motivo (`notaAmostra(n)`), em vez de a tela avisar genericamente. E a `description` passa a nomear a âncora: "ativos em 30 dias conta até a data do último dado carregado, não até o fim da receita".

---

## cs — 16 achados (3 de risco alto)

### Risco alto · "A IA resolveu sozinha?" — 62% do denominador é ticket que NINGUÉM respondeu, e a descrição afirma o contrário

- **Onde:** `src/features/cs/cs-page.tsx:279-310 (description em 289-293); RPC public.bi_cs_atendimento_ia_humano`
- **Categoria:** numero-errado
- **Evidência:** SQL rodado com os argumentos da página (p_dias=30): select count(*) filter (where not tem_atendente_humano) sem_humano_total, ... from marts.fact_cs_atendimento where abriu_em_brt > (now() at tz 'America/Sao_Paulo')::date - 30 → sem_humano_total 97 · sem_humano_modo_ia 37 · sem_humano_modo_humano 60 · pct_que_a_tela_publica 0,2990 · pct_so_do_modo_ia 0,5676. A definição do mart é explícita (20260812211335_cs_ddl_atendimento.sql:69-72): "modo_ia = quem está conduzindo o ticket agora; tem_atendente_humano = houve humano em algum momento". Logo `not tem_atendente_humano and modo_ia='human'` = o ticket foi passado para modo humano e NINGUÉM respondeu — são 60 dos 97, e 52 desses estão em_aberto. A tela publica sobre esses 97: headline "29,9%" + headlineLabel "dos ciclos sem humano terminaram resolvidos", e a description diz literalmente "Ciclo sem atendente humano registrado — a IA respondeu e ninguém precisou entrar". A IA de fato conduziu 37 ciclos, e nesses a resposta é 56,8%, não 29,9%.
- **Conserto proposto:** Ou a RPC particiona por `modo_ia` (o card passa a ter dois grupos nomeados: conduzido pela IA × largado em modo humano, que é a barra que o CS precisa ver), ou o headline passa a sair de `modo_ia='ai' and not tem_atendente_humano` e a description deixa de afirmar "a IA respondeu" sobre ticket sem resposta nenhuma. O que não pode continuar é a descrição afirmar participação da IA em 60 ciclos onde ela não existe.

### Risco alto · O card "Quem atendeu" responde a própria pergunta com hash: 7c0ed65b, 306301e8, b5e4cbb3…

- **Onde:** `src/features/cs/cs-page.tsx:318-353`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** pg_get_functiondef(public.bi_cs_atendimento_por_atendente) → `select left(a.atendente_hash, 8), count(*), count(distinct a.contato_hash) ...`. Rodado com o argumento da página (30): [{"atendente":"7c0ed65b","atendimentos":284},{"atendente":"306301e8","atendimentos":111},{"atendente":"b5e4cbb3","atendimentos":38}, … 10 linhas]. Na tela isso vai para uma coluna `<TableHead>Atendente</TableHead>` com busca `rotuloBusca="Buscar atendente"` e headline "10 pessoas atenderam no período". Conferido no schema: `marts.fact_cs_atendimento` só tem `atendente_hash` — não existe nome espelhado, então a tabela NÃO PODE responder "quem" com o dado de hoje.
- **Conserto proposto:** Duas saídas honestas: (a) pedir ao time do Pulse o nome do atendente (é staff interno, e o contrato de PII autoriza nome com valor em lista nominal de ação) e só então manter o card; ou (b) enquanto não houver nome, trocar a tabela por uma medida que o hash sustenta de verdade — concentração ("1 pessoa responde 284 dos 623 ciclos") — e tirar da tela a coluna de identificador e o campo "Buscar atendente", que hoje só é usável digitando hexadecimal.

### Risco alto · Kickoff e Reversão exibem headline "0" enquanto carregam e quando a consulta falha

- **Onde:** `src/features/cs/cs-page.tsx:636-640 e 673-678`
- **Categoria:** numero-errado
- **Evidência:** Código literal: `headline={semCarga ? '—' : formatInt((kickoff.data ?? []).reduce((soma, e) => soma + Number(e.cards), 0))}` (idem para `reversao`). `semCarga` depende de `frescor` (`!frescor.isLoading && !frescor.isError && …`), então na carga inicial é `false`; `kickoff.data` é `undefined` → `[].reduce(…, 0)` → `formatInt(0)` → "0". E `TabelaCard` renderiza `<CardCabecalho {...cabecalho} />` SEMPRE, antes do ramo `isLoading`/`isError` (src/components/tabela/tabela-card.tsx:57-58): no estado de erro a tela mostra "0 clientes no quadro" em 3xl ao lado de "Não foi possível carregar os dados.". Valor real medido: bi_cs_funil('Kickoff') soma 352 e bi_cs_funil('Reversão') soma 62. Os outros dez cards da mesma página usam o padrão certo (`data?.[0] ? … : '—'`).
- **Conserto proposto:** Trocar por `kickoff.data ? formatInt(kickoff.data.reduce(...)) : '—'` (e igual em reversao), mantendo o ramo de `semCarga`. Zero é uma medida, ausência não é — é a mesma doutrina já aplicada ao KpiCard e ao CategoryDatum.value.

### Atenção · "Quase metade das solicitações está sem motivo" — são dois terços (67,0%), e a frase aparece duas vezes

- **Onde:** `src/features/cs/cs-page.tsx:182-187 e 606`
- **Categoria:** numero-errado
- **Evidência:** select count(*) total, count(*) filter (where tem_motivo) com_motivo, round(1 - count(*) filter (where tem_motivo)::numeric/count(*),4) from marts.fact_cs_cancelamento → total 549 · com_motivo 181 · sem_motivo 0,6703. Polaridade confirmada em 20260812211521_cs_ddl_pipeline_retencao.sql:220-235 ("o campo de motivo é texto livre e a origem só entrega o booleano `tem_motivo`"). A tela afirma "quase metade" no bloco de limitações ("quase metade das solicitações está sem preenchimento") e de novo na description do card de tipo de acordo ("motivo é texto livre e quase metade está vazia").
- **Conserto proposto:** Trocar as duas ocorrências por "dois terços" — ou, melhor, derivar o número: `tem_motivo` já está no mart, então uma coluna a mais em `bi_cs_cancelamento_desfecho` faz a régua viajar com o dado em vez de envelhecer no JSX (é a mesma disciplina de "zero dígito no gabarito" do motor de achados).

### Atenção · Enum cru da origem no headline e nos eixos: "258 em reembolso_total", acao_judicial, em_aberto, vigia

- **Onde:** `src/features/cs/cs-page.tsx:300-308, 583-592, 600-605`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** Rodado: bi_cs_cancelamento_desfecho() → reembolso_total 258 · (ainda sem acordo) 136 · cancelamento 78 · revertido 39 · reembolso_parcial 16 · multa 15 · acao_judicial 4 · downgrade 3. A página faz `headline={formatInt(cancelDesfecho.data[0].solicitacoes)}` + `headlineLabel={`em ${cancelDesfecho.data[0].tipo_acordo}`}` → o número maior da tela lê **"258 em reembolso_total"**. bi_cs_cancelamento_origem() → manual 402 · vigia 85 · ia 62, plotados crus no eixo. bi_cs_atendimento_ia_humano(30) → desfechos `resolvido` e `em_aberto`, plotados crus (o comentário na linha 111-114 assume: "Vocabulário da origem, não rótulo de exibição"). A MESMA página traduz no card ao lado: `r.desfecho === 'EM_ABERTO' ? 'Em aberto' : …` (linhas 541-548).
- **Conserto proposto:** Um mapa de rótulos por dimensão (como já existe para o desfecho da retenção), aplicado no `category` e no `headlineLabel`. `reembolso_total` → "Reembolso total", `acao_judicial` → "Ação judicial", `em_aberto` → "Em aberto", `vigia` → o nome de negócio do sistema. Valor desconhecido cai no próprio texto, não em "outros".

### Atenção · O aviso do topo publica nome de tabela do mart — e alerta sobre uma fonte que nenhum card desta tela lê

- **Onde:** `src/features/cs/cs-page.tsx:159-174`
- **Categoria:** telemetria-de-engenharia
- **Evidência:** bi_cs_frescor() devolve 9 linhas com `tabela` = atendimento · avulso · cancelamento · card · disparo · empresa · envio · movimento · status_diario. Hoje `fonte_parada = true` só em **avulso** (ultimo_evento_brt 2026-07-06, dias_sem_evento 44). A página renderiza `${f.tabela} (último em …)` cru, então a tela diz: "Uma fonte parou de receber evento novo: avulso (último em 06/07/2026). O que essa fonte alimenta está congelado nessa data". Conferido no banco: select proname from pg_proc … where pg_get_functiondef ilike '%fact_cs_avulso%' or '%fact_cs_movimento%' or '%fact_cs_status_diario%' → **[] (zero funções)**. Nenhuma RPC do produto lê avulso: o aviso é permanente e não afeta nenhum número da tela.
- **Conserto proposto:** Filtrar `fontesParadas` para as fontes que esta tela de fato consome (atendimento, cancelamento, card, disparo, empresa, envio) e mapear o nome técnico para o nome de negócio ("atendimento" → Atendimentos, "envio" → Comunicação enviada). Alarme que aparece todo dia sobre coisa que não muda número nenhum ensina a ignorar o bloco — que aqui é o bloco que dá régua a todo o resto.

### Atenção · "Onde cada caso está parado nos quadros do CS" mostra 2 de 6 quadros — 94% dos cards ficam fora sem aviso

- **Onde:** `src/features/cs/cs-page.tsx:627-630`
- **Categoria:** regua-nao-declarada
- **Evidência:** select quadro, count(*) from marts.fact_cs_card group by 1 → Jornada do cliente 3.113 · Financeiro 2.606 · Cancelamento 495 · Kickoff 352 · Associate Implementation 180 · Reversão 62 (total 6.808). A página fixa só dois: `const QUADRO_KICKOFF = 'Kickoff'` e `const QUADRO_REVERSAO = 'Reversão'` (linhas 52-53), e a seção se intitula "Onde cada caso está parado nos quadros do CS". São 414 de 6.808 cards na tela — 6,1%. Nem o título, nem a prosa da seção, nem as descriptions declaram o recorte. (O corte não está na RPC: `bi_cs_funil` não tem LIMIT nem HAVING.)
- **Conserto proposto:** Declarar na prosa da seção quais quadros entram e por quê ("dos seis quadros do Pulse, a tela mostra os dois de intervenção; Jornada do cliente, Financeiro, Cancelamento e Associate Implementation ficam fora"), ou trocar o título por um que não prometa a totalidade. É a mesma lição do `limiteDaFonte`: o corte tem de morar onde o leitor está.

### Atenção · Dois cards lideram com o mês EM CURSO rotulado "no último mês" — 328 contra 12,3 mil do mês fechado

- **Onde:** `src/features/cs/cs-page.tsx:400-405 e 488-493`
- **Categoria:** regua-nao-declarada
- **Evidência:** bi_cs_frescor() → ultimo_evento_brt = 2026-08-19 (hoje), ou seja agosto tem 19 de 31 dias. bi_cs_disparos_mensal() → 2026-06 pessoas 3.473 · 2026-07 pessoas 12.255 · 2026-08 pessoas **328**. A página faz `headline={formatCompact(Number(disparosMensal.data.at(-1)!.pessoas))}` + `headlineLabel="pessoas alcançadas no último mês"` → lê "328 pessoas alcançadas no último mês". Mesmo padrão em bi_cs_cancelamento_mensal() → 2026-07 106 · 2026-08 **76**, com headline "76 no último mês". Na mesma tela o card irmão "Atendimentos por mês" evita o problema liderando pelo melhor mês (669, abr/26) — três cards do mesmo formato, duas regras diferentes.
- **Conserto proposto:** Liderar pelo último mês FECHADO (e dizer qual é), ou manter o mês corrente e escrever no headlineLabel que ele está aberto ("no mês em curso, até 19/08"). É o mesmo motivo pelo qual a janela do produto ancora em marts.data_referencia(): comparação contra período parcial mede o calendário, não o cliente.

### Atenção · Os headlines dos dois quadros contam CARDS e afirmam clientes/empresas — e "já perseguidas" contradiz a própria descrição

- **Onde:** `src/features/cs/cs-page.tsx:636-641 e 673-678`
- **Categoria:** numero-errado
- **Evidência:** select quadro, count(*) cards, count(distinct empresa_id) empresas, count(distinct empresa_hash) hashes, count(distinct id_via) id_vias from marts.fact_cs_card where quadro in ('Kickoff','Reversão') group by 1 → Kickoff: cards 352, empresa_id 352, empresa_hash **346**, id_via **272**; Reversão: cards 62, empresa_id 62, empresa_hash **60**, id_via **45**. A tela publica "352 clientes no quadro" e "62 empresas já perseguidas". No mesmo ecrã o card de retenção declara grão de cliente DEDUPLICADO ("o mesmo cliente com cadastro repetido conta uma vez"), régua que estes dois não aplicam. E obj_description('marts.fact_cs_card') diz: "Foto dos cards em etapa ativa … Card removido SOME da origem" — logo "já perseguidas" (acumulado histórico) descreve algo que a tabela não guarda, e contradiz a prosa da própria seção ("Foto da posição atual dos cards, não fluxo do período").
- **Conserto proposto:** Trocar os headlineLabel para o grão real: "cards no quadro" (ou contar distinct empresa_hash na RPC, se a pergunta for por cliente) e, na Reversão, "empresas em tentativa agora" no lugar de "já perseguidas". O histórico de passagem existe em marts.fact_cs_movimento — é de lá que sairia um "já perseguidas" verdadeiro.

### Atenção · A tela estoura quatro das cinco réguas de densidade: 12 cards, 6 seções, 6/6 prosas acima de 240, zero descritivos

- **Onde:** `src/features/cs/cs-page.tsx:247, 316, 394, 482, 566, 630`
- **Categoria:** densidade-ou-ordem
- **Evidência:** Medido no fonte com o mesmo regex do densidade.test.ts: `<(?:ChartCard|TabelaCard)\b` → **12** (teto absoluto 9); `<SecaoDeAnalise\b` → **6** (teto 5); `<TableHead\b` → 12 (bate com TETO_POR_TELA); comprimento das seis `descricao` de seção → **289, 287, 380, 287, 311, 301** — as seis acima do teto de 240, a maior sendo 380; `nivel="descritivo"` → **0** (mínimo 1). Não há `DENSIDADE_DECLARADA:` no arquivo (grep vazio). CS não está em TELAS_NA_DENSIDADE, então o CI não cobra — mas TETO_POR_TELA já a registra como a pior do produto em cards (12).
- **Conserto proposto:** Fundir por PERGUNTA, não por eixo: "Como o pedido chega e como ele termina" (2 cards) responde a mesma pergunta de "Quantos pedem para sair, e onde esses casos param" — as duas viram uma seção de cancelamento. Idem "Por onde o ciclo entrou, e quem respondeu" com a de atendimento. Ao encurtar as prosas, achar o destino de cada cláusula antes de cortar (description do card ou a régua do nav-items): metade delas hoje é a única declaração de que o seletor de dias não alcança o card.

### Atenção · Nenhum dos 12 cards declara `nivel` — a escada não é avaliável e as duas regras de ordem passam a vazio

- **Onde:** `src/features/cs/cs-page.tsx (arquivo inteiro)`
- **Categoria:** nivel-desonesto
- **Evidência:** grep de `nivel="` em src/features/cs/cs-page.tsx → **0 ocorrências** para 12 ChartCard/TabelaCard. Consequência medida contra src/lib/escada.ts e src/lib/densidade.ts: avaliarComposicao devolveria 3 falhas (0 comparativos, 0 diagnósticos, 0 prescritivos) e avaliarDensidade devolveria `descritivosNoMinimo`. Pior: `picoPorSecao` fica [-1,-1,-1,-1,-1,-1], então `primeiraSecaoNaoSoDescritiva` e `prescritivoNaoSoNoFim` passam por ausência de dado, não por cumprimento — a tela é aprovada nas duas regras de ORDEM justamente por não declarar nada. CS está fora de TELAS_NA_REGUA, então é dívida visível, não defeito escondido.
- **Conserto proposto:** Declarar o nível dos 12 e aceitar o que a declaração revelar. Pelo que os cards fazem hoje: quase todos são descritivos ou comparativos, e não há um único prescritivo — nenhum card diz o que fazer sobre quem. O candidato natural é a lista de PERDIDO com acesso ativo (256 clientes, já calculada em `conflita_base`), que é lista nominal de ação de verdade e hoje só existe como número num headlineLabel.

### Observação · "Atendimentos por canal" diz que mostra número, mostra nome de caixa — e os nomes são pessoas

- **Onde:** `src/features/cs/cs-page.tsx:364`
- **Categoria:** outro
- **Evidência:** bi_cs_atendimento_por_canal(30) → Milagre Digital 480 · Stephanie 30 · Financeiro 29 · Anderson 29 · Joana 26 · Anna Jullia 26 · Renovação 3. A description do card afirma "Número da Central por onde o ciclo entrou". O DDL do mart separa as duas coisas (20260812211335_cs_ddl_atendimento.sql:76-80): "`canal` é o nome da CAIXA (inbox), não o meio de contato … canal_numero é a linha da própria empresa". A RPC serve `canal`, não `canal_numero`. O efeito na tela é que quatro barras rotuladas "canal" são primeiros nomes de pessoas, na MESMA seção em que o card vizinho se chama "Quem atendeu".
- **Conserto proposto:** Trocar a description para "Caixa de entrada da Central por onde o ciclo chegou — o nome é da caixa, não de quem atendeu". O comentário do DDL já traz a frase pronta, e ele também mostra que a nota "Milagre Digital cobre 99,8%" envelheceu: hoje são 7 caixas e 77% (480/623).

### Observação · KPI "Clientes retidos (total)" publica 48 de uma carteira de 489, sem o outro lado que a mesma RPC já devolve

- **Onde:** `src/features/cs/cs-page.tsx:229-236`
- **Categoria:** outro
- **Evidência:** bi_cs_kpis(30) → retidos 48 · em_aberto 88 · perdidos 353 · perdidos_com_base_ativa 256. A fileira de KPIs usa só `retidos`; `perdidos`, `em_aberto` e `perdidos_com_base_ativa` são calculados e descartados (a página os relê de bi_cs_retencao lá embaixo). bi_cs_retencao() confirma a carteira: PERDIDO 353 · EM_ABERTO 88 · RETIDO 48 = 489, que é exatamente o count de marts.dim_cs_empresa. Quem lê só a fileira do topo leva "48 clientes retidos" sem os 441 restantes.
- **Conserto proposto:** Ou o tile passa a mostrar a razão (48 de 489, com o denominador no rótulo), ou o quarto tile vira "Clientes perdidos" — que é o número que move decisão e já vem pronto na mesma linha da RPC. Como está, o KPI escolhe o menor dos três desfechos e não dá denominador.

### Observação · O gráfico de retenção coage qualquer desfecho desconhecido para "Retido"

- **Onde:** `src/features/cs/cs-page.tsx:541-548`
- **Categoria:** outro
- **Evidência:** Código literal: `category: r.desfecho === 'EM_ABERTO' ? 'Em aberto' : r.desfecho === 'PERDIDO' ? 'Perdido' : 'Retido'`. O ternário não tem ramo para valor inesperado — o fallback É "Retido". Hoje bi_cs_retencao() devolve exatamente 3 desfechos (PERDIDO, EM_ABERTO, RETIDO), então nada aparece errado; um quarto valor gravado pelo Pulse entra desenhado como "Retido", somando ao lado bom da métrica sem erro nenhum.
- **Conserto proposto:** Mapa explícito (`ROTULO_DESFECHO[r.desfecho] ?? r.desfecho`), com o valor cru aparecendo se não estiver mapeado. Rótulo desconhecido visível é ruído; rótulo desconhecido fundido no melhor balde é número errado silencioso.

### Observação · A tela tem seletor de período mas não o passa para AnaliseDaTela/PlanoDaTela

- **Onde:** `src/features/cs/cs-page.tsx:852-853`
- **Categoria:** outro
- **Evidência:** `<AnaliseDaTela tela="cs" />` e `<PlanoDaTela tela="cs" />`, sem `periodo`. nav-items.ts:325 declara `temPeriodo: true` para /cs, e a página monta `<PeriodoFiltro valor={periodo} …>`. A prop está documentada em analise-tela.tsx:101 como "omitir nas telas SEM seletor de período" — as únicas outras duas omissões são receita e organizacoes, que de fato não têm o controle. Efeito hoje é latente: `temRegra('cs')` é false, então o componente retorna cedo no ramo `semRegra` e a linha de escopo nunca chega a renderizar.
- **Conserto proposto:** Passar `periodo={periodo}` nos dois. Custa uma palavra agora; deixado como está, no dia em que CS ganhar regra no catálogo o documento vai afirmar achados sem dizer sobre que janela, e ninguém vai relacionar isso com esta linha.

### Observação · Na AbaDeDados, "Os quatro números do topo" rotula uma RPC de oito colunas

- **Onde:** `src/features/cs/cs-page.tsx:725-727`
- **Categoria:** outro
- **Evidência:** pg_get_functiondef(public.bi_cs_kpis) → RETURNS TABLE(atendimentos, contatos, solicitacoes_cancelamento, pessoas_impactadas, retidos, em_aberto, perdidos, perdidos_com_base_ativa) — oito colunas, todas renderizadas pela AbaDeDados. Quatro delas (`contatos`, `em_aberto`, `perdidos`, `perdidos_com_base_ativa`) não têm KPI correspondente no topo.
- **Conserto proposto:** Trocar o título por "Os números do topo, mais o que a RPC calcula e a tela não usa" — ou, melhor, resolver o achado do KPI acima e o título volta a ser verdade. As restantes 13 fontes da AbaDeDados batem uma a uma com os 14 hooks que a página usa; esta é a única legenda que não descreve o que mostra.

---

## Derrubados pela crítica

Ficam registrados porque é o que dá crédito ao resto: a lista foi filtrada, não só coletada.

- **Networking aparece como "descontinuado" e como "em dia" na mesma tabela** (visao-geral) — Contraria decisão registrada em dois pontos. CLAUDE.md, seção Rastreio: "⚠️ Módulo encerrado fecha em `descontinuado` antes de consultar fonte nenhuma. `marts.modulos_descontinuados()` lista Comunidade e Networking, que a plataforma tirou do ar (informado pelo Mateus em 18/08)" — o curto-circuito antes da fonte É o desenho. E a barra de Networking no gráfico de ações está coberta pela mesma linha: "O histórico NÃO sai dos fatos: janela que alcance o período em que o módulo existia continua contando as ações dele, porque sumir com elas reescreveria o passado." O próprio achado admite precisar de confirmação do Mateus sobre o que foi tirado do ar — é revisão de decisão dele, não defeito.
- **Módulos descontinuados aparecem em dois cards de Clientes** (clientes) — O conserto proposto (excluir `= any(marts.modulos_descontinuados())` do desenho) contraria decisão registrada no CLAUDE.md: "O histórico NÃO sai dos fatos: janela que alcance o período em que o módulo existia continua contando as ações dele, porque sumir com elas reescreveria o passado." Os dois cards são justamente histórico (mortalidade e autópsia de churn sobre a base inteira), que é o caso que a regra protege. `modulos_descontinuados()` foi criada para o card de rastreio, que pede conserto, não para apagar módulo de série histórica.
- **A tela está no teto da catraca e reprovaria a régua absoluta em quatro medidas** (clientes) — É dívida já registrada, não achado. CLAUDE.md: "Adoção por lista (TELAS_NA_DENSIDADE), como a escada — 7 das 10 telas em 19/ago; faltam clientes, CS e receita", e densidade.ts confirma que clientes está só em TETO_POR_TELA. O próprio achado conclui "Nada a fazer sem decisão do Mateus — é a fase de densidade que ainda não chegou nesta tela". Reportar de novo é repetir o que a lista já torna visível. O material sobre onde fundir vale como nota para a fase, não como defeito.
- **Nenhum dos 5 cards declara `nivel=`, e a tela não tem card prescritivo** (receita) — É dívida registrada. escada.test.ts não lista receita em TELAS_NA_REGUA e o CLAUDE.md registra a adoção por lista com os nomes das três telas pendentes — "faltam clientes, CS e receita". O achado mede corretamente que a tela não tem prescritivo, mas essa é a conclusão que a lista já publica. A sugestão de qual seria o prescritivo (faturas que falharam e nunca foram pagas) é boa e vale como insumo da fase, não como defeito.
- **As três prosas de seção passam de 240, e a seção do meio tem um card só** (receita) — Mesma dívida registrada: receita não está em TELAS_NA_DENSIDADE (densidade.ts) e o CLAUDE.md nomeia as três telas que faltam. O achado confirma que os eixos de TETO_POR_TELA (5 cards, 14 colunas) estão no limite e não acima — ou seja, a catraca está segurando, que é o que ela existe para fazer.
- **A tela estoura quatro das cinco réguas de densidade** (cs) — Dívida registrada. CLAUDE.md: "Adoção por lista (TELAS_NA_DENSIDADE) — 7 das 10 telas em 19/ago; faltam clientes, CS e receita", e densidade.ts registra CS só em TETO_POR_TELA, com o comentário de que ela é a pior do produto em cards (12). A medição do achado está correta e bate com o teto declarado; ela reproduz o que a lista já torna visível. As sugestões de fusão por pergunta ficam como insumo da fase.
- **Nenhum dos 12 cards declara `nivel`** (cs) — Mesma dívida registrada — CS está fora de TELAS_NA_REGUA em escada.test.ts, e o próprio achado conclui "é dívida visível, não defeito escondido". Registro para a fase, porque é o pedaço que não é redundante: com picoPorSecao todo em -1, `primeiraSecaoNaoSoDescritiva` e `prescritivoNaoSoNoFim` passam por ausência de dado, não por cumprimento — vale considerar se a régua deveria tratar tela sem nenhuma declaração como não avaliável em vez de aprovada.

