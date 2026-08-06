# Product BI — instruções do projeto

## O que é

Plataforma de análise de dados (BI) central da Viver de IA. Projeto de alta visibilidade para a empresa: a barra de qualidade é **impecável e ultra organizado** — isso é requisito, não preferência.

## Regras de trabalho

- Organização acima de velocidade. Sem atalhos, sem TODO solto, sem código morto, sem gambiarra "temporária".
- `npm run lint` e `npm run build` limpos antes de dar qualquer entrega por concluída.
- Mudança visual só está pronta depois de verificada no navegador (desktop 1280px e mobile 375px).
- Texto de UI sempre em pt-BR.
- Trabalho evolui em fases confirmadas com o Mateus — não avançar de fase sem o OK dele.

## Design system

Referência oficial: **Viver de IA DS** — https://github.com/rafaelmilagre7/viver-de-ia-ds · site vivo https://viver-de-ia-ds.vercel.app. Tokens portados para `src/index.css` (fonte da verdade, 3 camadas: primitivos `--via-*` → semânticos shadcn → `@theme inline`).

Regras inegociáveis herdadas do DS:

- **LIGHT-FIRST (regra zero)**: a marca é clara. Branco/off-white é o padrão de tudo; navy `#0A1F3B` é cor de texto/ação/detalhe, nunca fundo de página. Dark mode existe e é completo, mas é escolha do usuário (toggle no header) — `defaultTheme="light"`.
- **Paleta restrita**: branco · off-white · cinzas · azul-escuro `#1E3A5F` · navy · preto. Coral `#B85C5C`/danger só destrutivo real; verde `#1F8A5B` só status. **BANIDO**: gold/amarelo/roxo/cyan/magenta/neon, gradientes quentes.
- **Fonte: Outfit** (decisão do Mateus, no lugar da Geist do DS) + **JetBrains Mono** para números/código/tabelas (fallback oficial do DS). Self-hosted via `@fontsource-variable/*`. Pesos: body 400–500, headings 500–600 — nunca bold massivo. Tracking negativo leve já aplicado no base.
- Nunca hardcodar cor/raio/sombra — sempre token. Raios canônicos: xs 6 · sm 10 · md 14 (botão/input) · lg 20 (**card padrão**) · xl 28 (modal/card grande) · 2xl 40. Sombras navy-tinted no light, pretas no dark (`--shadow-*` já mapeadas).
- Pills/chips: 11px, peso 500, sem uppercase, sem bolinha decorativa (dot só status real ao vivo). CTAs sentence-case, verbo no infinitivo, 2–4 palavras.
- Ícones Lucide, stroke 1.5–2, `currentColor`. Banido ícone Sparkles/"AI sparkle".
- Sem emoji decorativo em UI; sem clichês de IA em copy.
- Todo controle tem os 3 estados (`:hover`, `:active`, `:focus-visible`); disabled muta por cor, não por opacity. Contraste AA nos 2 temas, sempre.
- **Ajuste deliberado em `src/components/ui/card.tsx`**: `rounded-xl` → `rounded-lg` (card padrão do DS = 20px). Se regenerar o card via shadcn CLI, reaplicar.
- **Superfícies da marca em `src/index.css`**: `.page-atmosphere` (radiais navy sutis — vai no `<main>` e em páginas públicas; sem ela o vidro não tem o que refletir) e `.glass-card` (receita canônica de 5 camadas, adapta no dark, solidifica com `prefers-reduced-transparency`/`prefers-contrast`). KpiCard, ChartCard e o card do login já usam; card de tabela densa fica plano (regra do DS). Sem hover/lift em card que não é clicável.

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

- `ChartCard` — moldura obrigatória: título + estados loading/erro/vazio/refetch (refetch mantém o frame com opacidade reduzida).
- `KpiCard`/`KpiGrid` — stat tile com count-up, delta assinado (`upIsGood` decide a cor), sparkline; grid com entrada escalonada.
- `TimeSeriesChart` — linha/área; máximo de 2 séries **garantido por tipo**; 2ª série tracejada + legenda com chave de linha; tooltip com crosshair e valores formatados.
- `CategoryBarChart` — colunas ou barras horizontais; ≤24px, ponta 4px, base no zero, valor na ponta; eixos `width="auto"` (largura fixa corta rótulo).
- `DonutChart` — composição; ordena desc e agrega excedente em "Outros" (máx. 5 fatias); total no centro.
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

## Estrutura

```
src/
  app/          providers + router
  components/
    layout/     shell autenticado (sidebar, header, nav-items.ts)
    ui/         shadcn — gerado por CLI, fora do lint, não editar à mão
  features/<x>/ módulos com estado/lógica própria
  lib/          env.ts (validado com Zod), supabase.ts, utils.ts
  pages/        páginas de rota simples
  types/        types gerados do banco
```

Módulo novo: página em `pages/` ou `features/` → rota em `src/app/router.tsx` (dentro de ProtectedRoute → AppLayout) → item em `src/components/layout/nav-items.ts` → migration + `db:types` se tocar banco.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | dev server :5173 (preview via `.claude/launch.json`) |
| `npm run build` | type-check + build |
| `npm run lint` | ESLint |
| `npm run typecheck` | só type-check |
| `npm run db:types` | regenera types do banco |
