# Product BI — instruções do projeto

## O que é

Plataforma de análise de dados (BI) central da Viver de IA. Projeto de alta visibilidade para a empresa: a barra de qualidade é **impecável e ultra organizado** — isso é requisito, não preferência.

## Regras de trabalho

- Organização acima de velocidade. Sem atalhos, sem TODO solto, sem código morto, sem gambiarra "temporária".
- `npm run lint`, `npm test` e `npm run build` limpos antes de dar qualquer entrega por concluída. O CI (`.github/workflows/ci.yml`) roda os três em push e PR.
- **Commitar cedo.** Em 10/ago um `git reset` destruiu ~8h de trabalho não commitado; o que estava no banco sobreviveu, o disco não.
- Mudança visual só está pronta depois de verificada no navegador (desktop 1280px e mobile 375px).
- Texto de UI sempre em pt-BR.
- Trabalho evolui em fases confirmadas com o Mateus — não avançar de fase sem o OK dele.

## Design system

Referência oficial: **Viver de IA DS** — https://github.com/rafaelmilagre7/viver-de-ia-ds · site vivo https://viver-de-ia-ds.vercel.app. Tokens portados para `src/index.css` (fonte da verdade, 3 camadas: primitivos `--via-*` → semânticos shadcn → `@theme inline`).

Regras inegociáveis herdadas do DS:

- **LIGHT-FIRST (regra zero)**: a marca é clara. Dark mode existe e é completo, mas é escolha do usuário (toggle no header) — `defaultTheme="light"`.
  - **Canvas é cinza quase branco, card é branco**: `--via-canvas: #f4f5f7` + `--via-card-borda`. Enquanto os dois eram `#ffffff`, o card só existia por uma borda de 5% e a tela lia como uma folha só. A separação vem de **borda fina e sombra**, não de contraste de fundo. O cinza é neutro de propósito — a escala do DS é fria por construção e, numa página inteira, lê como lavanda.
    - ⚠️ **O shell novo substituiu estas duas superfícies por três** (página · seção · card, em `--via-superficie-*`) e o contraste passou a ser estrutural, não só de borda — a aba ativa da barra depende dele para existir. `--via-canvas` saiu junto. Ver "Layout do produto".
  - **Navy é componente, nunca fundo de página**: vale para o canvas. O `.brand-card` é navy por ser componente. ⚠️ A barra `--nav-surface` deixa de ser navy no shell novo — barra e rail passam a ser **brancos** e o navy recua para tinta, disco da marca e bloco de destaque. É a regra zero levada até o fim, não uma exceção a ela.
- **Paleta restrita**: branco · off-white · cinzas · azul-escuro `#1E3A5F` · navy · preto. Coral `#B85C5C`/danger só destrutivo real; verde `#1F8A5B` só status. **BANIDO**: gold/amarelo/roxo/cyan/magenta/neon, gradientes quentes.
- **Fonte: Outfit** (decisão do Mateus, no lugar da Geist do DS) + **JetBrains Mono** para números/código/tabelas (fallback oficial do DS). Self-hosted via `@fontsource-variable/*`. Pesos: body 400–500, headings 500–600 — nunca bold massivo. Tracking negativo leve já aplicado no base.
- Nunca hardcodar cor/raio/sombra — sempre token. Raios canônicos: xs 6 · sm 10 · md 14 (botão/input) · lg 20 (**card padrão**) · xl 28 (modal/card grande) · 2xl 40. Sombras navy-tinted no light, pretas no dark (`--shadow-*` já mapeadas).
- Pills/chips: 11px, peso 500, sem uppercase, sem bolinha decorativa (dot só status real ao vivo). CTAs sentence-case, verbo no infinitivo, 2–4 palavras.
- Ícones Lucide, stroke 1.5–2, `currentColor`. Banido ícone Sparkles/"AI sparkle".
- Sem emoji decorativo em UI; sem clichês de IA em copy.
- Todo controle tem os 3 estados (`:hover`, `:active`, `:focus-visible`); disabled muta por cor, não por opacity. Contraste AA nos 2 temas, sempre.
- **Ajustes deliberados em `src/components/ui/` — reaplicar se regenerar pelo CLI:**
  - `card.tsx`: `rounded-xl` → `rounded-lg` (card padrão do DS = 20px) e respiro `py-5`/`px-5`/`gap-5`. **20px é a régua única de todo card do produto** — ChartCard e KpiCard não repetem o valor, herdam da primitiva.
  - `table.tsx`: cabeçalho recessivo (`text-xs`, `text-muted-foreground`, altura automática) e célula `px-3 py-2.5` → linha de 41px, doze linhas sem passar da dobra.
  - `chart.tsx`: rótulo de eixo usa `fill-data-ink`, não `fill-muted-foreground`. O token `--data-ink` existia, estava mapeado e **nenhum componente usava** — a documentação afirmava o contrário. Contraste medido: 7,06:1 no claro, 8,47:1 no escuro.
  - Por que na primitiva e não em `@layer components` no `index.css`: utilitário do Tailwind vence a camada de componentes, então padding e cor voltavam ao padrão do shadcn — mesma armadilha do `.brand-card`.
- ⚠️ O gradiente do `.glass-card` é **de opacidade alta e faixa curta**. A receita antiga ia de 96% a 58% e fazia o card **mudar de cor conforme a altura** — dois brancos diferentes na mesma tela. Não restaurar o gradiente longo.
- ⚠️ `.brand-card` **redeclara tokens semânticos** em vez de sobrescrever `color`: utilitário do Tailwind vence CSS da camada de componentes, e `color: #fff` deixa o título navy sobre navy. A rampa de dataviz dentro dele é a do tema escuro, já validada. Uso: **um por tela**.
- **Superfícies da marca em `src/index.css`**: `.page-atmosphere` (radiais sutis, vai no shell e em páginas públicas), `.glass-card` (card padrão: branco, hairline e sombra; solidifica com `prefers-reduced-transparency`/`prefers-contrast`) e `.brand-card` (destaque navy). Sem hover/lift em card que não é clicável.

## Gráficos

Gráficos são o coração do produto — capricho máximo aqui. Regras do DS (validadas por script de CVD/contraste — não decidir cor no olho):

- Recharts, sempre através do wrapper `src/components/ui/chart.tsx` (ChartContainer/ChartConfig).
- **Séries**: 1 série → `--data-1` sem legenda (o título nomeia). 2 séries → `--data-1` + `--data-2` **mais um segundo canal obrigatório** (tracejado/marcador) + rótulo direto. 3+ séries → **não inventar 3ª cor**: small multiples ou agrupar em "Outros". Status (verde/coral) nunca vira série.
- Rampa monocromática `--chart-1..5` para segmentos/stacked/categorias dentro da família navy.
- **`--data-mute`** (`#a3acbd` claro · `#4a5570` escuro) é a série que recua quando UMA é destacada (`{ mute: true }` no dado do `CategoryBarChart`). Lê como cinza de propósito — o validador da skill reprovaria como slot categórico, e é exatamente o que se quer. A separação vem da **croma** (saturado × neutro), com luminância de apoio. **Não é uma terceira cor de série.**
- **`--data-referencia`** é a meta, a média, o limiar (`referencias` no `CategoryBarChart`): tracejado em neutro forte, no máximo dois por gráfico. Referência não é dado, então nunca usa cor de série. É o degrau mais barato da escada — transforma "quanto" em "quanto comparado a quê".
- **Um eixo só — nunca eixo duplo** (erro nº 1). Barra ancorada em zero. Cor segue a entidade, nunca o rank. Sequencial = 1 hue claro→escuro; divergente = 2 polos + cinza; nunca arco-íris. Projeção sempre tracejada + indicada na legenda.
- Grade recessiva `--data-grid`, eixo `--data-axis`, rótulos com `--data-ink` (token de texto, nunca cor de série). Linha 2px, marcador 8px+.
- **Proibido**: 3D, gloss, sombra em barra, gradiente em série única, pizza com muitas fatias, eixo y de barra fora do zero.
- Tabela densa é plana (sem vidro) — números com a utility `num` (mono + tabular, à direita). Vidro fica nos cards de métrica ao redor.
- **Antes de escrever qualquer código de gráfico, carregar a skill `dataviz`** (Skill tool).
- Todo gráfico funciona em light e dark e degrada bem em mobile.

### Kit de gráficos (`src/components/charts/`)

Páginas usam SEMPRE o kit — nunca montar Recharts cru em página de produto:

- `CardCabecalho` (`src/components/ui-marca/`) — **uma gramática de cabeçalho para todo card de conteúdo**: identidade à esquerda, afordância à direita. `icon` + título curto numa linha, `headline` com o número que responde o card (mais `headlineLabel`), e a `description` vira o conteúdo do botão circular de informação — a definição da métrica não sai da tela, sai do caminho. `action` substitui o botão quando o card tem controle próprio (o seletor de tela na Jornada).
  - **Todo card de conteúdo tem `icon` e `headline`.** Card sem número que o responda é sinal de que a pergunta dele não está clara.
  - **O headline sai do dado que o próprio card desenha** e nunca é fatia sobre lista cortada: RPC com `LIMITE_LISTA` ou `p_limite` só permite liderar pela primeira linha (a ordenação garante), nunca por um total somado. Antes de usar percentual, conferir no banco se a função tem `LIMIT`.
- `ChartCard` — moldura de gráfico: `CardCabecalho` + estados loading/erro/vazio/refetch. `tone="brand"` para o bloco de destaque, **um por tela**.
- `TabelaCard` (`src/components/tabela/`) — o par do ChartCard para lista: mesmo cabeçalho + estados de carregando e erro. Toda tabela de produto vive dentro dele. Ficam em `Card` cru só o formulário de login e os avisos de limitação do dado.
- `KpiCard`/`KpiGrid` — stat tile com count-up, delta assinado (`upIsGood` decide a cor), sparkline; grid com entrada escalonada. Três estados de exceção, todos distintos: erro ("não foi possível carregar"), e **sem amostra** (`value: null` + `motivoSemValor` — travessão com o porquê, para percentual suprimido pela régua de 30). Nunca `?? 0` em valor de KPI.
- `TimeSeriesChart` — linha/área; máximo de 2 séries **garantido por tipo**; 2ª série tracejada + legenda com chave de linha; tooltip com crosshair e valores formatados.
- `CategoryBarChart` — colunas ou barras horizontais; ≤24px, ponta 4px, base no zero, valor na ponta; eixos `width="auto"` (largura fixa corta rótulo). `nota` por dado leva uma **segunda medida só para o tooltip** — é anotação, nunca segunda série nem segundo eixo, e chega já formatada com a unidade escrita. Existe para o caso em que a barra responde "quanto" e a análise escrita afirma "que proporção": sem esse canal o texto publica um número que o gráfico ancorado não mostra, e quem clicou para conferir não encontra o que veio conferir.
- `DonutChart` — composição; ordena desc e agrega excedente em "Outros" (máx. 5 fatias); total no centro.
- `HeatmapChart` — dia×hora em grid CSS (não Recharts); sequencial = UM hue por alfa de `--data-1` (funciona nos 2 temas por construção); tooltip por célula; semana seg→dom.
- Formatadores pt-BR em `src/lib/format.ts` — não criar Intl.NumberFormat solto em página.

**Animação (aprendido na prática):** `isAnimationActive={false}` em TODO elemento Recharts — o controlador de animação dele congela sob rAF-throttling (aba oculta) e o draw-in corrompe `strokeDasharray` customizado. Entrada de gráfico é via `ChartReveal` (motion, time-based, respeita `prefers-reduced-motion`): `left` p/ séries/barras horizontais, `up` p/ colunas, `scale` p/ donut.

**Par de séries no dark divergem do DS de referência**: `#4E96F0`/`#3168B4` (re-degrauados pelo validador da skill dataviz — o par original reprovava no piso de visão normal). Não "corrigir" de volta para os valores do repo do DS.

Showcase interno em `/design` — toda peça nova do kit é validada lá (light + dark + mobile) antes de entrar em módulo de produto.

## Stack

Vite 8 · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (new-york) · React Router · TanStack Query · Recharts · RHF + Zod · Supabase.

## Supabase

- Projeto `product-bi` — ref `xkxxmekeofdoigrrbaoe`, região `sa-east-1`, org viverdeia.
- Painel: https://supabase.com/dashboard/project/xkxxmekeofdoigrrbaoe
- **Toda DDL vira migration versionada em `supabase/migrations/`**, mesmo quando aplicada via MCP (aplicar via MCP + salvar o mesmo SQL no repo, com timestamp no nome).
- Após qualquer DDL: rodar advisors (security e performance) e zerar warnings; regenerar types com `npm run db:types` (ou via MCP → `src/types/database.types.ts`).
- Funções auxiliares de policy vivem no schema `private` (fora da API REST). Usar `private.is_admin()` nas policies de novas tabelas.
- RLS ligada em toda tabela nova, sem exceção — **com a policy de leitura junto, no mesmo commit**. As RPCs são SECURITY INVOKER: RLS sem policy faz a função devolver **zero linha em silêncio, sem erro**. Custou caro duas vezes; na segunda, o bloco de resumo publicou "As 0 regras desta tela foram avaliadas", que é uma frase honesta sobre um estado falso. Schema novo também precisa de `grant usage`.

### Motor de achados (`insights`)

O bloco "Resumo e direcionamento" sai de um motor determinístico — **sem modelo de linguagem no caminho**. Regras que não são estéticas:

- **O achado é calculado, não redigido.** `insights.regra` guarda a frase como gabarito com marcadores; `insights.calcular_achados_<tela>` calcula os valores. Quem preenche é `src/features/resumo/gabarito.ts`, com os formatadores pt-BR de sempre.
- **O calculador só lê `public.bi_*`** — nunca `marts.`/`etl.`. É o que garante que o número da frase é O MESMO do card, e não uma segunda conta que pode divergir. Teste no CI reprova (`contrato-do-motor.test.ts`). A única exceção é `marts.data_referencia()`, que compõe a chave do cache e não é métrica.
- **Zero dígito no gabarito.** A régua viaja em `parametros` emitido pela mesma função que calcula — mude a janela no SQL e a frase acompanha. Teste no CI reprova.
- **Score é múltiplo do próprio limiar**, nunca a magnitude bruta: sem isso, regras de unidades diferentes (pontos percentuais × porcentagem × multiplicador) competem numa escala que não existe e a ordem sai do acaso.
- **Máximo 3 achados, 1 por família**, e o bloco tem permissão de dizer que não há nada a dizer — inclusive listando o que foi suprimido e por quê.
- **Cache em `insights.achado_cache`**, chaveado por `(tela, período, recorte, data do dado)`. Sem ele são 2,5s por tela e o bloco estoura o timeout sob a concorrência da página; com ele, 5ms. A chave inclui a data do dado, então o sync invalida sozinho. **Migration que mexe em regra termina com `delete from insights.achado_cache where chave like '<tela>|%'`** — o conjunto de regras não entra na chave, então sem a purga a tela serve o texto antigo sem erro nenhum.
- **O número da frase existe num card da tela — sempre.** Não é retórica: o calculador tem de chamar a RPC com os MESMOS argumentos que a página usa. `bi_pontos_saida(p_dias, 10)` no motor e `p_limite: 10` na página são o mesmo conjunto de linhas de propósito. Foi por violar isto que `org_time_morto` (RPC com limite 100.000 contra card com 25) e mais duas regras foram recusadas em 12/ago: publicariam número que não existe em lugar nenhum da tela. Quando a pergunta é boa e o número falta, o certo é a tela passar a mostrar o número — foi o que se fez no card "Onde a sessão morre".
- **Regex de contrato lê SQL sem comentário.** `contrato-do-motor.test.ts` limpa `--…` antes de casar. As migrations comentam as próprias armadilhas e citam `etl.`/`marts.` e marcadores `{…}` em prosa; sem a limpeza, o teste reprova a migration mais bem documentada e, pior, a aspa de um gabarito emparelha com a do seguinte e o "gabarito" extraído vira um trecho de consulta que passa por acidente. Há um segundo teste só para pegar essa extração falsa.

### Pipeline de dados (BI ← plataforma)

- Fonte única: banco da plataforma `product_viverdeia_platform` (ref `zotzvtepvpnkcoobdubt`), via **postgres_fdw** — servidor `plataforma_srv`, host = **session pooler** `aws-0-sa-east-1.pooler.supabase.com:5432` (a rota direta IPv6 não fecha entre os projetos; não "corrigir").
- Credencial: user mapping do role `postgres` criado **manualmente** no SQL editor pelo Mateus — a senha nunca entra em migration/repo/chat. Conexão como `postgres` remoto é intencional (dono das tabelas → leitura íntegra sob RLS).
- Schemas: `plataforma` (58 foreign tables, somente leitura) · `marts` (dim/fact consumidos pelo app) · `etl` (watermarks `sync_state` + log `sync_runs`). Nenhum exposto na API REST; RLS deny-all neles é intencional (advisors INFO esperados).
- Sync: funções `etl.sync_*` incrementais por watermark (fatias de ≤45 dias por chamada) + `etl.executar_sync()` no pg_cron `bi_sync_plataforma` a cada 30 min. Agregações pesadas SEMPRE nos marts locais, nunca na produção.
- **Janela ancora em `marts.data_referencia()`, nunca em `now()`.** A função devolve o último dia com dado carregado. Com o pipeline saudável ela é hoje e nada muda; com o pipeline parado, "últimos 30 dias" continuaria contando 30 dias de calendário sobre 27 de dado e o delta passaria a medir a parada, não o cliente — foi o defeito "Pageviews +313,3%" em outra roupa. RPC nova já nasce com ela. **Dívida declarada:** ~43 funções `bi_*` ainda usam `now()` e migram na fase que reescrever cada tela; as `bi_cs_*` ficam de fora de propósito, porque a fonte delas é o Pulse e terá frescor próprio.
- Regras herdadas da plataforma em toda métrica: exclusões de `bi_cohort_base` (campo `e_cliente` na dim) e timezone `America/Sao_Paulo` (colunas `*_brt` pré-computadas).

#### Modelo de domínio: quem é cliente, quem comprou (decisão do Mateus, 11/ago)

**Cliente = usuário da plataforma** sob a régua `e_cliente`. O comprador e quem ele convidou são, os dois, clientes — o BI não conta gente de fora da plataforma.

**Quem comprou é `is_master_user`, não o papel.** O master user recebe o convite, é dono da organização e é quem comprou o Viver de IA; os demais entram por convite dele. Duas colunas parecidas que **não** são a mesma coisa:

| Coluna | O que é | Cuidado |
| --- | --- | --- |
| `is_master` (`dim_usuario`) | **dono de organização = comprador**. Bate 1:1 com `organizations.master_user_id` (2.064 pessoas) | é a régua estrutural — use esta para separar comprador de convidado |
| `papel` (`dim_usuario`) | **tipo de contrato comprado** (`master_user`, `membro_club`, `hands_on`…) | 445 dos `membro_club` também são donos de org, e 223 `master_user` não são. Papel ≠ posição na organização |

Consequência para a análise: o recorte que explica retenção é **comprador × convidado** (36,9% × 18,9%), não o papel isolado — o produto retém quem paga e perde quem foi convidado. Como 91% dos clientes estão dentro de uma organização, isso é o centro do produto, não um segmento dele.

**Papel é do momento, não histórico:** a dim guarda o papel atual, e a plataforma já migrou gente em lote (5.222 de `freemium` para `hands_on`). Toda leitura por papel é "de quem hoje é X" — declarar isso onde a série atravessa uma migração.
- Enums remotos precisam de tipo local homônimo antes de `import foreign schema` (hoje só `consultor_planejamento_status`).

#### Contrato de PII (autorização do Mateus, 11/ago/2026)

**Está autorizado espelhar tudo que a plataforma e o Pulse têm, desde que sirva a uma análise registrada.** O limite não é a natureza do dado — é a existência da pergunta. Tabela sem pergunta não vira mart só porque cabe.

Quatro disciplinas, que não custam nada em poder analítico:

1. **Chave no lugar do valor quando a análise só precisa distinguir.** `count(distinct)` funciona igual sobre hash — é o padrão já adotado no espelho de CS (`wa_phone_key` em vez do telefone). Vale por padrão para telefone, documento e destinatário de disparo. **Exceção legítima:** nome, e-mail e organização entram com valor em **lista nominal de ação** (clientes em risco, power users), porque ali a análise exige identificar a pessoa para agir — o controle passa a ser de acesso, não de armazenamento.
2. **Conteúdo livre só entra se alguma análise exigir.** Hoje nenhuma exige: texto de mensagem do Consultor, corpo de notificação, justificativa de cancelamento — todos rendem agregado. Mantém-se a decisão da Entrega 6 (mensagem do Consultor entra como agregado usuário+dia; o texto não sai da plataforma).
3. **Exclusão propaga.** Se a plataforma apaga alguém, o mart apaga junto. Guardar quem a origem excluiu é o único ponto em que espelhar amplo vira risco real, independentemente de autorização.
   - ⚠️ **O sync incremental NÃO CONSEGUE ver exclusão.** Ele lê por watermark — linhas com `updated_at` maior que a marca — e linha apagada não tem `updated_at`; ela simplesmente deixa de existir. Não é bug de função, é limite do desenho. Descoberto em 13/08 com **211 pessoas apagadas e 4.662 linhas vivas** nos espelhos.
   - Quem resolve é `etl.propagar_exclusoes()`, no pg_cron **diário** (`bi_propagar_exclusoes`, 04:10 BRT), com **dois critérios**: por PESSOA (sumiu de `plataforma.profiles`) e por CHAVE (o `id` sumiu da origem). Só o de chave teria limpado 438 das 4.662 — a plataforma apaga o perfil e deixa a atividade órfã no banco dela, então 33 dos 43 fantasmas ainda tinham linha na origem.
   - **O critério de chave não vale para pageview e navegação**: a origem purga navegação com +30d e o BI guarda de propósito. Aplicá-lo ali apagaria o arquivo.
   - ⚠️ **A guarda de sanidade é obrigatória em qualquer passo que apague por ausência na origem.** "Não existe lá" com o FDW caído é verdade para TODAS as linhas, e o passo apagaria os marts inteiros dentro do cron, de madrugada. `propagar_exclusoes` aborta se `profiles` vier com menos de 90% do tamanho da dim.
   - `marts.contar_linhas_de_apagados()` deve devolver **zero**; qualquer valor acima é o passo falhando em silêncio.
   - ⚠️ **O mesmo limite atinge UPDATE, não só DELETE.** A plataforma grava `is_completed`/`completed_at` sem tocar em `last_activity`, e `used_at` sem tocar em `updated_at` — então o incremental nunca revê a linha e a mudança some para sempre. Custou 31 conclusões de solução reais (07–13/08/2026) faltando numa métrica central. Corrigido em duas frentes: `greatest(...)` sobre toda coluna mutável na chave incremental, e `etl.reconciliar_valores()` no cron diário (`bi_reconciliar_valores`, 04:20 BRT) como rede para o que ninguém mapeou. **Sync novo: antes de escolher a coluna de watermark, conferir QUAIS colunas a origem muda sem carimbar.**
   - **Efeito colateral que ninguém tinha notado:** os órfãos faziam a mesma métrica ter dois valores. `fact_progresso_aula` devolvia 148.744 contando direto e 148.115 juntando a dim. Hoje devolve 148.115 nos dois caminhos.
4. **Lista nominal exige papel.** O BI tem hoje 2 contas, ambas `member`, e nenhuma tela distingue papel. Quando o time entrar, **lista com nome/e-mail fica atrás de `private.is_admin()`**; o agregado continua para todos.
5. **O hash do Pulse é reversível por comparação — e não se usa isso.** O contrato `bi_pulse` entrega telefone, e-mail e nome como hash, e o nosso role tem `execute` em `bi_pulse.hash_pii` porque **sem ele as views nem abrem**. A consequência, levantada espontaneamente pelo time do Pulse em 12/ago: dá para hashear um valor que já se conhece e comparar com a coluna, confirmando se aquela pessoa está lá. É inerente ao desenho, não há como remover sem quebrar o contrato. **Fica registrado como capacidade conhecida e não utilizada:** hash do Pulse entra em `count(distinct)` e em join, nunca em busca por valor conhecido. Se algum dia uma análise precisar identificar a pessoa do lado do CS, o caminho é pedir o campo ao time do Pulse — não é derivar por comparação de hash.
- **Mapa das origens: `docs/mapa-dados-plataforma.md`** — 211 tabelas dos 3 bancos com volume, período, qualidade e as perguntas que cada domínio destrava. É a referência de origem; `discovery-banco-plataforma.md` e `dicionario-dados-plataforma.md` viraram material histórico.
- **O MCP do Supabase alcança os três bancos direto** (plataforma, CS Pulse, BI). O FDW parado bloqueia a carga dos marts, não a análise do schema de origem — não esperar o pipeline para investigar dado.
- ⚠️ **A plataforma apaga histórico por cron dominical.** `cleanup-analytics-views` (navegação com +30d) está inativo hoje, mas já rodou: os pageviews de 03–09/07/2026 **só existem no nosso mart**. As purgas de `notifications` estão ativas. O BI não é só consumidor — é arquivo.

## Estrutura

```
src/
  app/          providers + router
  components/
    charts/     kit de gráficos
    layout/     shell: app-layout, app-barra + aba-canal, app-rail,
                cabecalho-de-modulo, secao-de-analise, bento, nav-items
    filters/    período e segmento — controles de recorte da tela
    tabela/     tabela-longa (lista paginada) e lista-de-acao (quem contatar)
    ui-marca/   peças da marca fora do shadcn: card-cabecalho, status-pill,
                controle-segmentado, frescor-do-dado
    ui/         shadcn — gerado por CLI, fora do lint, não editar à mão
  features/<x>/ módulos com estado/lógica própria
  lib/          env.ts (validado com Zod), supabase.ts, utils.ts
  pages/        páginas de rota simples
  types/        types gerados do banco
```

Módulo novo: página em `pages/` ou `features/` → rota em `src/app/router.tsx` (dentro de ProtectedRoute → AppLayout, via `lazy()`) → item em `src/components/layout/nav-items.ts` (com `shortTitle`, e `abas` se tiver) → migration + `db:types` se tocar banco.

### Layout do produto — o shell (medido na referência, 13/ago/2026)

Refeito a partir de um mockup de referência que o Mateus trouxe, com **fidelidade como requisito declarado**. Os números abaixo saíram de medição de pixel na imagem, não de estimativa: cinco tentativas foram recusadas por eu estar interpretando a referência em vez de medi-la. Mockup navegável e aprovado: **`docs/mockup-layout.html`**.

> **Estado: a fundação está construída e validada; as PÁGINAS ainda não foram migradas.** O shell, a rampa de superfícies e as peças novas estão em `src/` e vivem no showcase `/design`. As dez telas ainda desenham o próprio cabeçalho e ainda não usam `CabecalhoDeModulo` nem `SecaoDeAnalise` — é a fase seguinte, e ela depende do catálogo de análises.

**Três superfícies, nesta ordem: página → seção → card.**

Tokens em `src/index.css`, camada 1 (`--via-superficie-*`) → camada 2 (`--background`, `--secao`, `--controle`) → `@theme inline` (`bg-secao`, `bg-controle`).

| camada | claro | escuro | quem usa |
| --- | --- | --- | --- |
| página | `#edeef1` | `#0a1120` | o fundo em que barra, rail e cards pousam — **e a cor da aba ativa** |
| seção | `#e5e6e9` | `#0f1728` | contêiner que agrupa cards da mesma pergunta |
| controle | `#e9eaee` | `#1a2440` | pílula de aba inativa, trilho do segmentado, tile de ícone |
| card / cromo | `#ffffff` | `#131c30` | barra, rail e card — o único branco |

⚠️ **Houve uma MOLDURA — um retângulo cinza arredondado envolvendo barra e conteúdo — e ela saiu em 13/ago.** Estava no mockup de referência e foi construída; o Mateus a recusou na tela real por deixar tudo fechado. Ela cobrava dois paddings e um raio grande para desenhar uma borda que não separava nada. O papel dela era dar superfície contínua para a aba se fundir, e esse papel passou para a própria página — que assumiu o valor claro que era da moldura, porque o degrau escuro anterior só existia como margem em volta do quadro. **Não reintroduzir**: se um bloco precisar de fundo próprio, o lugar é a `SecaoDeAnalise`.

- ⚠️ **O piso entre página e cromo é funcional, não estético, e tem critério DIFERENTE por tema.** A aba ativa é pintada com a cor da página; com os dois a 3% de distância (foi o caso com `#f5f6f9`) a aba simplesmente não aparece e o header inteiro perde o sentido.
  - claro: **≥ 6% de luminância absoluta** — hoje 6,7%.
  - escuro: **≥ 1,5× de razão de luminância** — hoje 1,66×.
  - Aplicar a régua do claro no escuro reprovaria um par que funciona (4,3% absolutos); aplicar a do escuro no claro aprovaria um par invisível (branco contra página é 1,07×). Em nível baixo o olho lê razão; em nível alto lê diferença. Conferir por medição, não no olho.
- **As cores do mockup NÃO entraram cruas.** Elas tinham spread de canal 12 (a diferença entre o maior e o menor canal RGB), e o DS exige neutro — a escala de cinzas dele é fria por construção e, no tamanho de uma página, isso lê como lavanda. Os valores acima mantêm as mesmas luminâncias com spread 4.
- ⚠️ **O `--card` do escuro (`#131c30`) não pode mudar.** A rampa de dataviz do tema escuro foi validada pelo script da skill contra essa superfície exata. Foi por isso que a página do escuro desceu em vez de o cromo subir: mexer no card invalidaria a validação de contraste e visão de cor sem ninguém perceber.
- No escuro a ordem se inverte — a página é a mais escura e o cromo sobe. Os valores do escuro são escolhidos, **não são o claro invertido**: inverter dá cinza sujo.
- **Raios: a escala canônica do DS basta.** barra e rail `2xl` 40 · seção `xl` 28 · card `lg` 20 · tile `md` 14 · pílula e circular `full`. O mockup nasceu com 34/30/26/24/18; encaixar na escala não mudou nada visualmente, e é o que permite o layout virar token em vez de número solto.

**A navegação voltou para o lado, e a reversão tem motivo medido.** O CLAUDE.md dizia "navegação no topo, a sidebar foi removida — não reintroduzir". O que estava errado era a *sidebar*, não o *lado*: ela era ícone **+ rótulo**, e a barra horizontal que a substituiu somava 1.189px de rótulo em dez módulos, só cabendo a partir de `xl`. O rail de agora é **só ícone, 68px**, então não disputa largura com os gráficos — e as abas do módulo saíram da página para dentro da barra, que é o que devolve a banda vertical que a sidebar antiga custava. Não reintroduzir **sidebar com rótulo**; o rail de ícone é a decisão vigente.

- `AppRail` (`app-rail.tsx`) — rail vertical branco, só ícone, agrupado por `GRUPOS_DE_NAV`, ferramentas no rodapé. **O tooltip É o rótulo** — sem ele o rail vira adivinhação, então sem delay.
- `AppBarra` (`app-barra.tsx`) — uma barra branca só: marca · aba ativa · abas inativas · busca · frescor · tema · conta. Substitui `app-header.tsx` (navy) e absorve `modulo-tabs.tsx`.
- `AppLayout` — calha lateral, largura máxima e nada mais entre o conteúdo e a borda da tela. Sem moldura. **A calha é estreita de propósito**: 12px a partir de `md` (era 20px) e 16px de folga entre rail e conteúdo (era 20px). Ela não separa nada — rail e cards já têm raio e sombra próprios — e cada pixel dela sai da largura que os gráficos disputam.

#### `AbaCanal` — a aba ativa (`aba-canal.tsx`)

A peça que define o layout inteiro. É um **canal da cor da página que atravessa a barra branca de cima a baixo e continua na tela**. Não é uma língua pendurada para fora da barra: a barra termina reta, e o que dá a sensação de "descer e virar tela" é a continuidade da cor mais o alargamento em S das laterais.

| medida | valor | de onde veio |
| --- | --- | --- |
| altura da barra | **64px** | a referência media 78px (y 54→132); baixou por decisão do Mateus em 17/ago, para devolver altura à tela |
| topo da aba | 7px abaixo do topo da barra | a faixa branca que a mantém *dentro* da barra |
| alargamento por lado | 80px | referência, 180px no topo → 340px na base |
| projeção abaixo da barra | **0** | a barra termina reta |
| tangente nas duas pontas | horizontal | é o que faz a curva entrar sem quina |

- ⚠️ **Altura da barra e recuo da aba mudam SEMPRE juntos, em dois arquivos.** O ombro é um SVG de viewBox `80×ALTURA` esticado até a altura real da barra, então o degrau dele cai em `RECUO/ALTURA` da altura — enquanto o miolo põe o degrau em `--aba-recuo` **pixels**. Os dois só coincidem enquanto as constantes de `aba-canal.tsx` repetirem os tokens de `index.css`. Mudar `--barra-altura` e esquecer do viewBox abre a emenda entre ombro e miolo, e o defeito é sutil o bastante para passar batido.
- **Três peças — ombro · miolo · ombro** — para a aba acompanhar qualquer rótulo. O miolo é retângulo (entre os ombros a largura é constante); os ombros são **SVG**, porque a forma é uma cúbica de verdade. `radial-gradient` só faz quarto de círculo e me traiu duas vezes seguidas nesta peça.
- **O alargamento ocupa largura de verdade**, sem margem negativa. Tentei abrir a aba por cima da vizinhança e o ombro comeu o "BI" da marca e a borda da pílula seguinte. Na referência a folga é real: ~85px de cada lado. É o preço da curva e entra no orçamento de largura do header.
- Funciona nos dois temas por construção, sem regra nova: a aba usa a cor da página, então no escuro ela é a mais escura e a barra é que sobe.

#### O corpo da tela

**título → controles → KPIs → seções.**

- **Os controles ficam no PÉ do bloco de título** (`CabecalhoDeModulo`, `mt-auto`), alinhados com o rodapé do painel da direita. Encostados no subtítulo deixam um buraco embaixo — foi defeito real da primeira versão desta tela.
- `ControleSegmentado` (`ui-marca/`) — período (7/30/90) e recortes curtos. **Um trilho só**, com o escolhido em branco sólido: o contorno é do trilho, não de cada opção, senão viram três botões concorrendo. Radix `ToggleGroup`.
- `FrescorDoDado` (`ui-marca/`) — "sincronizado há X". Não é enfeite: sem ele o leitor não sabe se "últimos 30 dias" terminam hoje ou no dia em que o pipeline parou. É a mesma pergunta que `marts.data_referencia()` responde no banco.
- `SecaoDeAnalise` (`layout/`) — **contêiner cinza que agrupa cards que respondem à mesma pergunta**, com cabeçalho próprio (título + controle da seção + ações). É a peça que faltava: sem ela a página é uma pilha de cards sem hierarquia, e é ela que o catálogo de análises vai preencher.
- **Mosaico dentro da seção**: o `BentoGrid` de 12 colunas com **um único gap** continua valendo, agora aninhado na seção em vez de solto na página. `BentoItem` aceita `span` e `rows`; card preenche a altura via `[&>*]:h-full` na primitiva — não repetir nas páginas.
- **Nunca pendurar `flex-wrap` direto no `BentoItem`**: todo filho direto herda o `h-full` do mosaico e, quando o flex quebra linha (mobile), o filho inflado estoura por cima do bloco de baixo. Foi defeito real medido em 7 telas (128–148px de sobreposição em 375px).

#### Bibliotecas: nenhuma nova é necessária

Levantado contra o mockup inteiro, peça por peça:

- **Gráficos — Recharts cobre tudo, e o que ele faz mal já é SVG/CSS na mão.** Heatmap é grid CSS, porque Recharts não tem célula de calendário decente. Manter na mão é o certo: fica orientado a token e passa pelo validador da skill `dataviz`. **Não adicionar lib de gauge, nem de heatmap, nem trocar Recharts.**
  - ⚠️ **O arco do mockup não foi construído, de propósito.** Ele mostrava "19,5 pp de diferença na retenção" — e um arco é um medidor, que só é forma correta para **razão contra um limite**. Diferença em pontos percentuais não tem máximo, então o arco teria que inventar um, e a proporção desenhada seria decoração fingindo de escala. A forma certa para esse número é figura de destaque (`headline` do `CardCabecalho`), que já existe. Se um dia aparecer razão com denominador de verdade (`31,8% usam 2+ módulos`), aí um medidor de trilho monocromático é legítimo — e o tipo dele tem que exigir o total, para não voltar a aceitar quantidade sem limite.
- **Controles — `radix-ui` 1.6.7 (já instalado) traz o que falta**: `ToggleGroup` (segmentado), `Popover`, `ScrollArea`, `Progress`, `Slider`, `Collapsible`. Zero dependência nova.
- **Forma da aba, seções, rail** — SVG inline e CSS. Nada disso pede biblioteca.
- **Animação** — `motion` já está, e `ChartReveal` já é a porta de entrada.
- ⚠️ **Uma pendência de produto, não técnica: a busca global do header.** Se for paleta de comando de verdade (Cmd+K, atravessa cliente/formação/solução), o caminho é `cmdk` (+~14kB, padrão do shadcn). Se for filtro da tela atual, não precisa de nada. **Decisão do Mateus** — não adicionar `cmdk` antes dela.

#### Peças novas e o que saiu

Novas: `aba-canal.tsx` · `app-barra.tsx` · `app-rail.tsx` · `aba-do-modulo.ts` (estado da aba, lido da URL) · `cabecalho-de-modulo.tsx` · `secao-de-analise.tsx` · `ui-marca/controle-segmentado.tsx` · `ui-marca/frescor-do-dado.tsx` · `tabela/lista-de-acao.tsx` · `lib/periodo.ts`.

Reformadas: `KpiCard` ganhou tile de ícone e uma casca única para os quatro estados — antes o tile de erro montava a própria casca, encolhia, e a fileira de KPIs ficava desalinhada justamente na tela em que algo deu errado.

Saiu: `app-header.tsx` (a barra navy). O `ModuloTabs` perdeu a `TabsList` e ficou só com o painel; `BentoCabecalho` sai quando as páginas migrarem para `CabecalhoDeModulo`.

⚠️ **Duas armadilhas de composição travadas no CI** (`contrato-de-shell.test.ts`), as duas silenciosas:

1. **`className` de função dentro de gatilho `asChild`.** O `Slot` do Radix concatena o className do gatilho com o do filho, e concatenar string com função escreve a FONTE da função no atributo `class`. O `NavLink` nunca chega a chamá-la: nenhum erro, nenhum aviso, e o item ativo fica idêntico aos outros. Nasceu assim no `AppRail` e só apareceu quando a cor de fundo foi medida no navegador — a olho, doze discos cinza parecem doze discos cinza. A saída é `useMatch` e `className` string.
2. **`TabsList` de volta no `ModuloTabs`.** Daria duas fileiras de abas na tela, e como as duas leem o mesmo `?aba=` elas concordariam entre si — pareceria decisão de layout, não defeito.

### Regras de módulo que atravessam o layout

- **Abas por contexto**: `analise` sempre primeira, e as seguintes fatiadas por pergunta quando a tela responde 3+ (`retencao`, `risco`, `funciona`). Tela de pergunta única fica com `analise` | `graficos` — Visão Geral e Organizações são assim, porque fatiar um panorama por tema deixa de ser panorama. A aba vive na URL (`?aba=`) e é declarada uma vez em `nav-items.ts`; **a barra do topo consome a mesma lista**.
  - **O `valor` da aba é o mesmo texto que a regra grava em `ancora_aba`.** Renomear a aba sem renomear no catálogo quebra o link "Ver o gráfico que sustenta" em silêncio: ele troca de aba e não rola para nada.
  - Fora das abas: título, controles, KPIs **e avisos de limitação do dado**.
- **Lista usa `TabelaLonga`** (busca + paginação, 12 por página). Vale para toda tabela cuja quantidade de linhas vem do dado — nomes, módulos, etapas, safras, destinos. Se a RPC corta em N linhas, a tela **declara o corte**.
  - Fica em `<Table>` cru o que é **bloco, não lista**: funil de etapas fixas, comparação de 2–3 grupos nomeados, baldes de status. O leitor lê o conjunto inteiro; busca e paginação ali só atrapalhariam (e nem apareceriam — a `TabelaLonga` esconde os controles abaixo de uma página).
  - **Matriz não pagina**: a grade de cohort corta nas 12 safras mais recentes e diz quantas ficaram de fora. Paginar cortaria a leitura diagonal no meio.
- **Estado usa `StatusPill`**, sempre com ícone e rótulo — nunca só cor.
- **Escada de profundidade** (`src/lib/escada.ts`): todo card declara `nivel` (`descritivo` · `comparativo` · `diagnostico` · `prescritivo`), que vira `data-nivel` no DOM. A régua de composição — no máximo 3 descritivos, no mínimo 2 comparativos, 2 diagnósticos e 1 prescritivo — é verificada por teste, e a tela entra na lista `TELAS_NA_REGUA` quando passa. "Profundo" deixa de ser gosto e vira condição de merge; a dívida das telas que ainda não subiram fica visível em vez de esquecida.
- **A leitura escrita e os gráficos são ABAS IRMÃS, não vizinhos na mesma página.** Padrão de tela: cabeçalho com filtros → KPIs → abas `Análise` | `Gráficos`. A aba `Análise` é a padrão: o produto existe para dizer o que os números significam, e o painel é a prova. A primeira versão punha a leitura numa faixa navy no topo, espremida entre o cabeçalho e os gráficos — parede de texto que lia como saída de sistema.
  - `AnaliseDaTela` (`src/features/resumo/analise-tela.tsx`) é o documento: duas colunas a partir de `lg` — achados à esquerda em medida de leitura (`68ch`), aparato à direita ("o que não dá para afirmar" e "como isto foi apurado"). Conteúdo e prestação de contas não se misturam na mesma coluna.
  - Cada achado tem **três degraus**: o fato (número + régua), a **leitura** (o que significa, e o que não significa) e a ação. Sem a leitura, o texto dá o número e manda fazer — o salto fica por conta de quem lê.
  - Card apontado por achado precisa de `id` (`ChartCard`/`TabelaCard`/`BentoItem` aceitam): a âncora troca de aba e rola até ele.
  - **`periodo` e `recorte` são opcionais e ficam de fora quando a tela não tem o controle.** Receita e Organizações não têm seletor de período; só Clientes e Visão Geral têm o recorte. A linha de escopo do documento só afirma o que a tela de fato oferece — anunciar "todos os papéis" onde não existe filtro de papel descreve um recorte que o leitor não pode mudar e sugere que os outros existem em algum lugar.
- **Descrição de card é RÉGUA, não changelog.** O que conta, a janela, a exclusão, a armadilha de leitura — em uma ou duas linhas. "A versão anterior deste card fazia X" é conversa com o revisor: vive no commit e no doc, nunca na tela.
- ⚠️ **A régua `e_cliente` é da RPC, não do mart.** Os fatos guardam todo mundo — admin, interno e teste — e quem filtra é quem lê. Auditado em 13/08: 5 de 59 RPCs de grão-cliente liam sem a régua, e o desvio ia de 2,3% (aula) a **30,8%** (consultor). Na tela de IA isso não era arredondamento: a ordem das faixas de profundidade mudou, "parou na 1ª mensagem" caiu de 3º para 5º maior. **RPC nova que toca fato de grão-cliente junta `dim_usuario` com `e_cliente` — sem exceção não declarada.**
  - `marts.fact_navegacao` é a única que **já nasce filtrada** (o filtro está na construção do fato). Quem a lê não precisa repetir a régua, e um grep por `e_cliente` a acusa como falso positivo.
  - Exceção declarada em `comment on function`: `bi_saude_rastreio` mede instrumentação, não cliente — filtrar esconderia o rastreio quebrado que só aparece no uso interno.
- **Recorte persona/plano** (contrato na seção Transversal do roadmap): filtro global `SegmentoFiltro` ao lado do período nas telas de grão cliente, estado na URL (`?papel=` e `?plano=`) e propagado pela navegação do shell via `comSegmento` — recorte é do app, não da tela. As RPCs centrais recebem `p_papel`/`p_plano` (null = todos). **Quem suprime percentual/taxa/média com denominador < 30 é o banco** (migration `20260811190000`); a tela só declara, com `notaAmostra`. Valores, rótulos e helpers do contrato vivem em `src/lib/segmento.ts` — não duplicar lista de papéis/planos em página.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | dev server :5173 (preview via `.claude/launch.json`) |
| `npm run build` | type-check + build |
| `npm run lint` | ESLint |
| `npm run typecheck` | só type-check |
| `npm test` | Vitest — contratos de métrica e formatação pt-BR |
| `npm run db:types` | regenera types do banco |
