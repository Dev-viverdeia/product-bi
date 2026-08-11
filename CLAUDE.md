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
  - **Navy é componente, nunca fundo de página**: vale para o canvas. A barra (`--nav-surface`) e o `.brand-card` são navy por serem componentes.
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
  - Por que na primitiva e não em `@layer components` no `index.css`: utilitário do Tailwind vence a camada de componentes, então padding e cor voltavam ao padrão do shadcn — mesma armadilha do `.brand-card`.
- ⚠️ O gradiente do `.glass-card` é **de opacidade alta e faixa curta**. A receita antiga ia de 96% a 58% e fazia o card **mudar de cor conforme a altura** — dois brancos diferentes na mesma tela. Não restaurar o gradiente longo.
- ⚠️ `.brand-card` **redeclara tokens semânticos** em vez de sobrescrever `color`: utilitário do Tailwind vence CSS da camada de componentes, e `color: #fff` deixa o título navy sobre navy. A rampa de dataviz dentro dele é a do tema escuro, já validada. Uso: **um por tela**.
- **Superfícies da marca em `src/index.css`**: `.page-atmosphere` (radiais sutis, vai no shell e em páginas públicas), `.glass-card` (card padrão: branco, hairline e sombra; solidifica com `prefers-reduced-transparency`/`prefers-contrast`) e `.brand-card` (destaque navy). Sem hover/lift em card que não é clicável.

## Gráficos

Gráficos são o coração do produto — capricho máximo aqui. Regras do DS (validadas por script de CVD/contraste — não decidir cor no olho):

- Recharts, sempre através do wrapper `src/components/ui/chart.tsx` (ChartContainer/ChartConfig).
- **Séries**: 1 série → `--data-1` sem legenda (o título nomeia). 2 séries → `--data-1` + `--data-2` **mais um segundo canal obrigatório** (tracejado/marcador) + rótulo direto. 3+ séries → **não inventar 3ª cor**: small multiples ou agrupar em "Outros". Status (verde/coral) nunca vira série.
- Rampa monocromática `--chart-1..5` para segmentos/stacked/categorias dentro da família navy.
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
- `CategoryBarChart` — colunas ou barras horizontais; ≤24px, ponta 4px, base no zero, valor na ponta; eixos `width="auto"` (largura fixa corta rótulo).
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
- RLS ligada em toda tabela nova, sem exceção.

### Pipeline de dados (BI ← plataforma)

- Fonte única: banco da plataforma `product_viverdeia_platform` (ref `zotzvtepvpnkcoobdubt`), via **postgres_fdw** — servidor `plataforma_srv`, host = **session pooler** `aws-0-sa-east-1.pooler.supabase.com:5432` (a rota direta IPv6 não fecha entre os projetos; não "corrigir").
- Credencial: user mapping do role `postgres` criado **manualmente** no SQL editor pelo Mateus — a senha nunca entra em migration/repo/chat. Conexão como `postgres` remoto é intencional (dono das tabelas → leitura íntegra sob RLS).
- Schemas: `plataforma` (58 foreign tables, somente leitura) · `marts` (dim/fact consumidos pelo app) · `etl` (watermarks `sync_state` + log `sync_runs`). Nenhum exposto na API REST; RLS deny-all neles é intencional (advisors INFO esperados).
- Sync: funções `etl.sync_*` incrementais por watermark (fatias de ≤45 dias por chamada) + `etl.executar_sync()` no pg_cron `bi_sync_plataforma` a cada 30 min. Agregações pesadas SEMPRE nos marts locais, nunca na produção.
- Regras herdadas da plataforma em toda métrica: exclusões de `bi_cohort_base` (campo `e_cliente` na dim) e timezone `America/Sao_Paulo` (colunas `*_brt` pré-computadas).
- Enums remotos precisam de tipo local homônimo antes de `import foreign schema` (hoje só `consultor_planejamento_status`).
- Discovery completo do banco da plataforma: `docs/discovery-banco-plataforma.md`.

## Estrutura

```
src/
  app/          providers + router
  components/
    charts/     kit de gráficos
    layout/     shell autenticado: app-header (barra navy), app-layout,
                bento.tsx, modulo-tabs.tsx, nav-items.ts, alerta-pipeline
    tabela/     tabela-longa.tsx (lista nominal com busca e paginação)
    ui-marca/   peças da marca fora do shadcn (status-pill)
    ui/         shadcn — gerado por CLI, fora do lint, não editar à mão
  features/<x>/ módulos com estado/lógica própria
  lib/          env.ts (validado com Zod), supabase.ts, utils.ts
  pages/        páginas de rota simples
  types/        types gerados do banco
```

Módulo novo: página em `pages/` ou `features/` → rota em `src/app/router.tsx` (dentro de ProtectedRoute → AppLayout, via `lazy()`) → item em `src/components/layout/nav-items.ts` (com `shortTitle`, e `abas` se tiver) → migration + `db:types` se tocar banco.

### Layout de módulo

- **Navegação no topo**, não lateral: barra navy flutuante (`AppHeader`). A sidebar foi removida — não reintroduzir.
- **Mosaico, não empilhamento**: a página é um `BentoGrid` de 12 colunas com **um único gap**. `BentoItem` aceita `span` e `rows`. Card preenche a altura via `[&>*]:h-full` na primitiva; não repetir nas páginas.
- **Abas por contexto** (`ModuloTabs`) quando a tela responde 3+ perguntas distintas. Visão Geral e Organizações ficam sem, de propósito. A aba vive na URL (`?aba=`) e é declarada uma vez em `nav-items.ts` — a barra do topo consome a mesma lista.
  - Fora das abas: cabeçalho, filtro de período, KPIs **e avisos de limitação do dado**.
- **Lista usa `TabelaLonga`** (busca + paginação, 12 por página). Vale para toda tabela cuja quantidade de linhas vem do dado — nomes, módulos, etapas, safras, destinos. Se a RPC corta em N linhas, a tela **declara o corte**.
  - Fica em `<Table>` cru o que é **bloco, não lista**: funil de etapas fixas, comparação de 2–3 grupos nomeados, baldes de status. O leitor lê o conjunto inteiro; busca e paginação ali só atrapalhariam (e nem apareceriam — a `TabelaLonga` esconde os controles abaixo de uma página).
  - **Matriz não pagina**: a grade de cohort corta nas 12 safras mais recentes e diz quantas ficaram de fora. Paginar cortaria a leitura diagonal no meio.
- **Estado usa `StatusPill`**, sempre com ícone e rótulo — nunca só cor.
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
