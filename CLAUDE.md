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
- Schemas: `plataforma` (**60** foreign tables, somente leitura) · `marts` (dim/fact consumidos pelo app) · `etl` (watermarks `sync_state` + log `sync_runs`). Nenhum exposto na API REST; RLS deny-all neles é intencional (advisors INFO esperados).
- Sync: funções `etl.sync_*` incrementais por watermark (fatias de ≤45 dias por chamada) + `etl.executar_sync()` no pg_cron `bi_sync_plataforma` a cada 30 min. Agregações pesadas SEMPRE nos marts locais, nunca na produção.
- **Janela ancora em `marts.data_referencia()`, nunca em `now()`.** A função devolve o último dia com dado carregado. Com o pipeline saudável ela é hoje e nada muda; com o pipeline parado, "últimos 30 dias" continuaria contando 30 dias de calendário sobre 27 de dado e o delta passaria a medir a parada, não o cliente — foi o defeito "Pageviews +313,3%" em outra roupa. RPC nova já nasce com ela. **Dívida FECHADA em 18/08**: as 22 funções de produto migraram (`bi_jornada_kpis` no passo 3 do lote, as outras 20 na migration `20260818050000`, com md5 do resultado conferido antes e depois — nenhum número mudou, que é o esperado com o pipeline vivo). Restam no relógio **7 funções, todas por decisão declarada**: as 6 `bi_cs_*`, porque a fonte delas é o Pulse e tem frescor próprio, e `bi_saude_pipeline`.
  - ⚠️ **`bi_saude_pipeline` NUNCA migra, e isso não é dívida esquecida** (o CLAUDE.md a listava por engano entre as 22). Ela calcula "horas desde a última sync" e "está defasado" — existe justamente para comparar o relógio do dado com o de parede. Ancorada em `data_referencia()` responderia zero hora para sempre, inclusive com o pipeline parado, que é o único momento em que alguém a lê. O motivo está no `comment on function`.
  - Ao migrar uma RPC, o padrão é `(select marts.data_referencia())` no filtro inline (vira InitPlan, avaliado uma vez) e `select marts.data_referencia() d` dentro de CTE `hoje` (que já é avaliada uma vez).
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
   - `marts.contar_linhas_de_apagados()` **zera na execução do cron e deriva ao longo do dia** — medido 17/08 às 21h UTC: **17 linhas órfãs**, com `bi_propagar_exclusoes` tendo rodado e **sucedido** às 04:10 BRT do mesmo dia. Não é o passo falhando: é o intervalo entre as varreduras, e a função conta 6 fatos (`fact_progresso_aula`, `fact_progresso_solucao`, `fact_certificado`, `fact_nps_aula`, `fact_evento`, `fact_pageview`) contra `plataforma.profiles` ao vivo. **A régua honesta é a de logo após o cron**; um número de duas casas no meio do dia é esperado, um de três ou quatro é o passo quebrado. Conferir sempre junto com a última execução do job, nunca sozinho.
   - ⚠️ **O mesmo limite atinge UPDATE, não só DELETE.** A plataforma grava `is_completed`/`completed_at` sem tocar em `last_activity`, e `used_at` sem tocar em `updated_at` — então o incremental nunca revê a linha e a mudança some para sempre. Custou 31 conclusões de solução reais (07–13/08/2026) faltando numa métrica central. Corrigido em duas frentes: `greatest(...)` sobre toda coluna mutável na chave incremental, e `etl.reconciliar_valores()` no cron diário (`bi_reconciliar_valores`, 04:20 BRT) como rede para o que ninguém mapeou. **Sync novo: antes de escolher a coluna de watermark, conferir QUAIS colunas a origem muda sem carimbar.**
   - **Efeito colateral que ninguém tinha notado:** os órfãos faziam a mesma métrica ter dois valores. `fact_progresso_aula` devolvia 148.744 contando direto e 148.115 juntando a dim. Hoje devolve 148.115 nos dois caminhos.
4. ⚠️ **Não há papel de admin — decisão do Mateus em 18/08/2026, e ela SUBSTITUI a régua anterior desta linha.** O contrato dizia "lista com nome/e-mail fica atrás de `private.is_admin()`". Não vai existir: quem tem conta no BI vê o mesmo. A função `private.is_admin()` continua no banco (é usada em policy de tabela), mas **não é gate de PII em tela nenhuma**.
   - **A consequência é que o controle deixa de ser de ACESSO e passa a ser de ARMAZENAMENTO**: o que não pode ser visto não pode ser servido. É por isso que a allowlist do Explorar (`marts.explorar_catalogo`) é a peça central daquela camada e não um acabamento — ela é o único controle que sobrou.
   - Segue valendo, e agora com mais peso: **hash e chave no lugar do valor** (`user_id`, `*_hash`, `empresa_id`) — o contrato abençoa chave, e é assim que o Explorar serve fato de grão-pessoa sem servir pessoa. A régua de quais nomes de coluna são identificador direto vive em `marts.identificadores_diretos()`: hoje `nome`, `email`, `organizacao`.
   - **As três RPCs que devolvem nome e e-mail seguem abertas a todo autenticado** por esta decisão, não por dívida: `bi_clientes_em_risco`, `bi_masters_top_convidadores` e `bi_ia_experimentaram_e_sumiram`. Eram duas no registro antigo — a terceira apareceu na conferência de 18/08.
5. **O hash do Pulse é reversível por comparação — e não se usa isso.** O contrato `bi_pulse` entrega telefone, e-mail e nome como hash, e o nosso role tem `execute` em `bi_pulse.hash_pii` porque **sem ele as views nem abrem**. A consequência, levantada espontaneamente pelo time do Pulse em 12/ago: dá para hashear um valor que já se conhece e comparar com a coluna, confirmando se aquela pessoa está lá. É inerente ao desenho, não há como remover sem quebrar o contrato. **Fica registrado como capacidade conhecida e não utilizada:** hash do Pulse entra em `count(distinct)` e em join, nunca em busca por valor conhecido. Se algum dia uma análise precisar identificar a pessoa do lado do CS, o caminho é pedir o campo ao time do Pulse — não é derivar por comparação de hash.
- **Rastreio parado é sintoma, não diagnóstico.** `marts.rastreio_por_tipo()` responde há quanto tempo um tipo de evento não registra — e isso **não separa cano entupido de torneira fechada**. Quem separa é `etl.corroborar_rastreio()` (cron diário `bi_corroborar_rastreio`, 04:45 BRT → `marts.rastreio_corroboracao`), comparando o evento com uma **fonte independente do mesmo fato** desde a última data registrada. Três vereditos: `quebrado` · `sem_uso` · `sem_corroboracao`. Medido em 18/08, os quatro parados se dividiam ao meio: `solution_started` e `connection_accepted` quebrados (a fonte seguia registrando), `community_post_created` e `community_comment` sem uso (evento e fonte param na **mesma data**). Uma guarda que tratasse os quatro igual publicaria diagnóstico falso em metade.
  - **Roda no cron, nunca na RPC**, por dois motivos medidos: a corroboração lê foreign table, e o card de saúde passaria a falhar exatamente quando o FDW cai — que é quando se olha para ele.
  - **Qualquer falha de leitura vira `sem_corroboracao`, nunca `sem_uso`.** Mesma guarda de sanidade de `propagar_exclusoes()`: com o FDW fora do ar, "a fonte não tem registro" é verdade para todas as fontes, e o passo concluiria "ninguém usa mais" para o produto inteiro, de madrugada.
  - **Fonte não espelhada = veredito não publicado.** O BI não publica o que não consegue recomputar.
  - ⚠️ **Módulo encerrado fecha em `descontinuado` antes de consultar fonte nenhuma.** `marts.modulos_descontinuados()` lista **Comunidade e Networking**, que a plataforma tirou do ar (informado pelo Mateus em 18/08). Sem isso o card pediria conserto para sempre sobre produto que não existe — e card que dá alarme falso todo dia ensina a ignorar o card, que aqui é grave porque é o card que prova os outros. **O histórico NÃO sai dos fatos**: janela que alcance o período em que o módulo existia continua contando as ações dele, porque sumir com elas reescreveria o passado.
- ⚠️ **Função SQL com cláusula `SET` NÃO faz inline** — e `set search_path to ''` é obrigatório aqui. As duas regras da casa se combinam num defeito que nenhuma prevê sozinha: `marts.evento_aposentado(tipo) -> boolean` num predicado de linha levou o mesmo scan de **31 ms para 371 ms** (12×), porque passou a ser chamada por linha. A saída não é abrir mão de nenhuma das duas, é mudar a forma: **régua compartilhada que entra em predicado de linha devolve CONJUNTO, nunca booleano por item.** `marts.eventos_aposentados() -> text[]`, sem argumento e `immutable`, o planejador dobra em constante e custa o mesmo que um literal.
- **Mapa das origens: `docs/mapa-dados-plataforma.md`** — 211 tabelas dos 3 bancos com volume, período, qualidade e as perguntas que cada domínio destrava. É a referência de origem; `discovery-banco-plataforma.md` e `dicionario-dados-plataforma.md` viraram material histórico.
- **O MCP do Supabase alcança os três bancos direto** (plataforma, CS Pulse, BI). O FDW parado bloqueia a carga dos marts, não a análise do schema de origem — não esperar o pipeline para investigar dado.
- ⚠️ **A plataforma apaga histórico por cron dominical.** `cleanup-analytics-views` (navegação com +30d) está **inativo hoje** (`cron.job.active = false`), mas rodou 4 domingos seguidos e apagou de verdade — 70.944, 66.633, 62.758 e **73.479 linhas em 09/08**, a execução que levou a semana de 03–09/07/2026. Ela **só existe em `marts.fact_pageview`** (73.296 linhas; a origem tem zero no intervalo) — e **não** em `marts.fact_navegacao`, que é derivada e reconstruída nos últimos 45 dias. O BI não é só consumidor — é arquivo, e o arquivo é o `fact_pageview`.
- ⚠️ **As duas purgas de `notifications` estão agendadas e NÃO apagam nada.** `cleanup-notifications-weekly` e `cleanup-old-notifications-weekly` marcam `active = true`, mas **as 5 execuções de cada uma falharam** com `ERROR: permission denied for function` (todo domingo de 19/07 a 16/08). Resultado medido: **546.616 notificações vivas** desde 21/10/2025, **348.473 com mais de 90 dias**. Não contar com essa purga para dimensionar a tabela, e não repetir "está ativa" — agendado e efetivo são coisas diferentes.

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

> **Estado (17/ago): as dez telas estão migradas.** Todas usam `CabecalhoDeModulo` — título e régua saem de `nav-items.ts`, a página não os reescreve — com os KPIs fora do mosaico e os cards agrupados em `SecaoDeAnalise` por pergunta. `/regras` ficou de fora do `CabecalhoDeModulo` de propósito: é ferramenta, e o `FrescorDoDado` que ele carrega carimbaria "dados até tal dia" num catálogo cuja régua é o limiar, não a carga.
>
> ⚠️ **Mover a régua para `nav-items.ts` FEZ ELA ENCOLHER em três telas**, e isso é o defeito a vigiar em toda tela nova: o que estava no subtítulo escrito à mão e não estava no `nav-items` some da tela sem erro nenhum. Jornada perdeu "rotas com identificador são agrupadas em padrão" (a única pista de que `/formacao/abc` e `/formacao/def` são a mesma linha do raio-x); Receita perdeu "faturas deduplicadas", que é a regra de contagem; e Entrada revelou uma contradição que já existia — o `nav-items` dizia "safra fechada de 30 dias" enquanto o card chama a RPC com o período do topo. Os três foram corrigidos na fonte. **Ao migrar ou criar tela, comparar o subtítulo antigo com a `regua` do `nav-items` cláusula por cláusula.**

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
- ⚠️ **Filho direto de `SecaoDeAnalise` é SEMPRE `BentoItem`.** Ela renderiza os filhos dentro de um `BentoGrid` (`grid-cols-1 md:grid-cols-6 xl:grid-cols-12`), então um `<div>` cru ali vira item de UMA coluna a partir de `md` — a página inteira espremida numa tira de 1/12 no desktop. **O modo de falha é o pior possível: no celular passa**, porque o grid é de uma coluna só, e o type-checker não vê nada. Custou as duas telas novas de 18/ago (`/plano` e `/explorar`), que foram montadas sem verificação de navegador. Travado em `contrato-de-tela.test.ts`. Bloco que não é mosaico de cards não deve usar `SecaoDeAnalise` — documento (`/plano`, `AnaliseDaTela`, `PlanoDaTela`) e ferramenta (`/explorar`) pousam direto na página.
- **Documento é duas colunas com a direita LIMITADA**: `lg:grid-cols-[minmax(0,68ch)_minmax(16rem,26rem)]`. Com `1fr` na direita, a 1720px do shell a coluna de apoio ganhava ~950px para um texto de 52ch e a leitura ficava estreita ao lado de meio metro de ar.
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

Saiu: `app-header.tsx` (a barra navy) e o `BentoCabecalho`, removido em 17/ago quando a última página deixou de usá-lo — cabeçalho de módulo agora é só o `CabecalhoDeModulo`. O `ModuloTabs` perdeu a `TabsList` e ficou só com o painel.

⚠️ **Duas armadilhas de composição travadas no CI** (`contrato-de-shell.test.ts`), as duas silenciosas:

1. **`className` de função dentro de gatilho `asChild`.** O `Slot` do Radix concatena o className do gatilho com o do filho, e concatenar string com função escreve a FONTE da função no atributo `class`. O `NavLink` nunca chega a chamá-la: nenhum erro, nenhum aviso, e o item ativo fica idêntico aos outros. Nasceu assim no `AppRail` e só apareceu quando a cor de fundo foi medida no navegador — a olho, doze discos cinza parecem doze discos cinza. A saída é `useMatch` e `className` string.
2. **`TabsList` de volta no `ModuloTabs`.** Daria duas fileiras de abas na tela, e como as duas leem o mesmo `?aba=` elas concordariam entre si — pareceria decisão de layout, não defeito.

### As três camadas (dados · análise · plano de ação)

Arquitetura decidida pelo Mateus em 17/ago e reconfirmada em 18/ago. Proposta e histórico em `docs/proposta-fase-3-direcionamento.md` §2.

- **Os dez módulos continuam sendo a navegação, e as três camadas viram as três ABAS de todo módulo**: `Gráficos` (o dado) · `Análise` (a leitura) · `Plano` (a sugestão). Fazer as camadas de topo em vez de aba quebraria o link "ver o gráfico que sustenta", que é o que amarra a frase ao número.
  - **`Gráficos` é a camada de dado INTEIRA**: os gráficos e, no fim, as linhas cruas de cada RPC que a tela leu (`AbaDeDados`). Não existe aba `Dados` separada — a primeira versão teve, e ela virava uma quarta aba fora do padrão.
- **`/plano` é seção de topo, e não substitui as abas — completa.** A aba `Plano` do módulo sugere o que fazer NAQUELA tela; `/plano` ordena os achados de TODAS as telas numa lista só, que é a pergunta que nenhum módulo responde. Fica no grupo `panorama` do rail.
  - **As abas de `/plano` são por SEVERIDADE** (`Risco alto` · `Atenção` · `Observação` · `Como foi apurado`), não pelas três camadas: ela já É uma das três. Trinta e três achados numa lista só viram rolagem que ninguém termina, e agrupar por módulo devolveria ao leitor a pergunta que a tela existe para responder. Por isso `/plano` está em `ROTAS_TRANSVERSAIS` e o contrato das três abas não vale para ela.
- ⚠️ **`/explorar` está OCULTO da navegação** (decisão do Mateus, 18/ago): `oculto: true` no `nav-items`. A rota segue viva e a allowlist do banco segue valendo — o que saiu foi a porta, não a camada. O item continua no array de propósito, para `moduloDaRota` achá-lo e o `CabecalhoDeModulo` manter título e régua; removê-lo faria a tela abrir sem cabeçalho.
- **`Plano de ação` agrega, não recalcula.** `bi_plano_de_acao` junta os achados JÁ calculados de cada tela e ordena por score. A cegueira entre telas do motor **continua valendo no cálculo** — o contrato de CI não foi afrouxado. A lista de telas sai de `insights.regra` e o nome da RPC é derivado do slug: tela nova com regra entra sozinha, e se a RPC faltar a função **aborta** em vez de omitir em silêncio.
  - Ordenar telas diferentes na mesma lista só é legítimo porque **score é múltiplo do próprio limiar** de cada regra. Sem essa normalização a lista seria um ranking do acaso.
  - ⚠️ **O motor está saturado** (33 de 34 regras disparam), então a **ordem** vale mais que a presença. A tela declara isso; recalibrar limiar é decisão em aberto.
- **`AbaDeDados`: nenhuma consulta nova.** Recebe as linhas JÁ carregadas pelos mesmos hooks que desenham os gráficos, e vive no fim da aba `Gráficos`. Se ela relesse o banco, passaria a existir uma segunda consulta capaz de divergir do card acima — o defeito que o projeto vem fechando em outras camadas. A garantia é estrutural: é o mesmo objeto em memória.
- **`PlanoDaTela` não calcula nada.** É o mesmo achado que a aba `Análise` lê — mesma RPC, mesmo cache, mesma régua. A aba muda o que fica em primeiro plano (a ação, com o fato como justificativa), nunca o número. O BI **reporta**: não há dono, prazo nem status, e nenhum item promete efeito atribuível, porque não existe experimentação em nenhuma das três fontes.
- **`Explorar`: allowlist congelada, e ela é o único controle.** `marts` **não está na API REST** e continua fora; quem serve é `bi_explorar_catalogo()` (índice) e `bi_explorar(tabela, limite, offset)` (linhas), contra `marts.explorar_catalogo`.
  - Congelada nos **dois eixos**: tabela nova não entra sozinha, coluna nova não passa a ser servida sozinha. Mudar exige migration.
  - **Allowlist, nunca blocklist** — bastaria espelhar uma coluna `telefone` para ela vazar sem ninguém notar (mesma armadilha da máscara por seletor CSS).
  - **A retenção é declarada com o nome do campo.** Esconder faria o leitor concluir que a coluna não existe.
  - O nome da tabela vem do cliente e é **validado contra o catálogo antes de qualquer interpolação**; coluna nunca vem do pedido. Teto rígido de 500 linhas por chamada.
  - **O catálogo é semeado do schema vivo menos `marts.identificadores_diretos()`, e congelado.** Semear evita erro de transcrição em 37 tabelas; congelar dá a semântica de allowlist. Foi a semeadura que achou `fact_fatura.email` e `master_snapshot.organizacao`, que uma lista à mão teria perdido.
- **Régua de célula crua em `CelulaBruta`**: o TIPO decide o formato, nunca o nome da coluna. Adivinhar semântica pelo nome (`pct_` é percentual?) erraria em silêncio.

### Regras de módulo que atravessam o layout

- **TRÊS ABAS, IGUAIS EM TODO MÓDULO** (decisão do Mateus, 18/ago/2026): `Gráficos` (o dado) · `Análise` (a leitura) · `Plano` (a sugestão). É a arquitetura de três camadas virando gramática de tela — o leitor aprende a ordem uma vez e ela vale em qualquer módulo. A aba vive na URL (`?aba=`), é declarada uma vez em `nav-items.ts`, e **a barra do topo consome a mesma lista**.
  - ⚠️ **Isto SUBSTITUIU as abas por pergunta** (`retencao`, `risco`, `funciona`, `funil`, `catalogo`, `adocao`, `telas`, `safra`…), que variavam de tela para tela. O agrupamento por pergunta **não se perdeu**: passou para a `SecaoDeAnalise` dentro de `Gráficos`, que é onde ele já morava visualmente. Não reintroduzir aba por pergunta.
  - **`graficos` é a primeira e portanto a PADRÃO** (`useAbaAtiva` cai em `abas[0]`). A ordem das abas é a ordem da leitura: dado → significado → ação.
  - ⚠️ **O `valor` da aba é o mesmo texto que a regra grava em `ancora_aba`, e hoje as 35 regras apontam todas para `graficos`.** Renomear esse valor quebra os 35 links "Ver o gráfico que sustenta" **em silêncio** — o link troca de aba e não rola para nada. Até 18/ago a única proteção era esta frase; agora `contrato-de-shell.test.ts` reprova a ausência da aba e a ordem errada. **Migration que mexer em `ancora_aba` precisa purgar `insights.achado_cache`**: o cache guarda o achado serializado, âncora inclusa, e serviria a antiga sem erro nenhum.
  - **Tela sem regra no catálogo declara isso** nas abas `Análise` e `Plano` em vez de ficar fora do padrão — é o caso de CS. Dívida visível na tela vale mais que exceção escondida no layout; `temRegra()` em `features/resumo/queries.ts` é quem decide.
  - Fora das abas: título, controles, KPIs **e avisos de limitação do dado**.
- **Lista usa `TabelaLonga`** (busca + paginação, 12 por página). Vale para toda tabela cuja quantidade de linhas vem do dado — nomes, módulos, etapas, safras, destinos. Se a RPC corta em N linhas, a tela **declara o corte**.
  - Fica em `<Table>` cru o que é **bloco, não lista**: funil de etapas fixas, comparação de 2–3 grupos nomeados, baldes de status. O leitor lê o conjunto inteiro; busca e paginação ali só atrapalhariam (e nem apareceriam — a `TabelaLonga` esconde os controles abaixo de uma página).
  - **Matriz não pagina**: a grade de cohort corta nas 12 safras mais recentes e diz quantas ficaram de fora. Paginar cortaria a leitura diagonal no meio.
- **Estado usa `StatusPill`**, sempre com ícone e rótulo — nunca só cor.
- **Escada de profundidade** (`src/lib/escada.ts`): todo card declara `nivel` (`descritivo` · `comparativo` · `diagnostico` · `prescritivo`), que vira `data-nivel` no DOM. A régua de composição — no máximo 3 descritivos, no mínimo 2 comparativos, 2 diagnósticos e 1 prescritivo — é verificada por teste, e a tela entra na lista `TELAS_NA_REGUA` quando passa. "Profundo" deixa de ser gosto e vira condição de merge; a dívida das telas que ainda não subiram fica visível em vez de esquecida.
- **A leitura escrita e os gráficos são ABAS IRMÃS, não vizinhos na mesma página.** Padrão de tela: cabeçalho com filtros → KPIs → abas `Gráficos` | `Análise` | `Plano`. A primeira versão punha a leitura numa faixa navy no topo, espremida entre o cabeçalho e os gráficos — parede de texto que lia como saída de sistema.
  - ⚠️ **A aba padrão passou de `Análise` para `Gráficos` em 18/ago**, por decisão do Mateus sobre a ordem das camadas (dado → análise → plano). A razão da escolha antiga segue verdadeira e vale registrar, porque é o custo assumido: o produto existe para dizer o que os números significam, e abrir no gráfico faz o leitor dar um clique a mais para chegar no significado. A ordem das três abas é o que resolve — a leitura está sempre no meio, entre o dado que a sustenta e a ação que sai dela.
  - `AnaliseDaTela` (`src/features/resumo/analise-tela.tsx`) é o documento: duas colunas a partir de `lg` — achados à esquerda em medida de leitura (`68ch`), aparato à direita ("o que não dá para afirmar" e "como isto foi apurado"). Conteúdo e prestação de contas não se misturam na mesma coluna.
  - Cada achado tem **três degraus**: o fato (número + régua), a **leitura** (o que significa, e o que não significa) e a ação. Sem a leitura, o texto dá o número e manda fazer — o salto fica por conta de quem lê.
  - Card apontado por achado precisa de `id` (`ChartCard`/`TabelaCard`/`BentoItem` aceitam): a âncora troca de aba e rola até ele.
  - **`periodo` e `recorte` são opcionais e ficam de fora quando a tela não tem o controle.** Receita e Organizações não têm seletor de período; só Clientes e Visão Geral têm o recorte. A linha de escopo do documento só afirma o que a tela de fato oferece — anunciar "todos os papéis" onde não existe filtro de papel descreve um recorte que o leitor não pode mudar e sugere que os outros existem em algum lugar.
- **Lista de achado revela em degraus** (`ui-marca/acordeao-de-achados.tsx`): fechada, cada linha traz título, pílula e **uma linha sempre visível**; a profundidade abre com um clique. Cada achado carrega três parágrafos e uma caixa de ação, e empilhados eles viram rolagem que ninguém termina — 16 achados na faixa "Observação" do `/plano` eram ~50 blocos de texto em coluna única. Radix `Accordion`, zero dependência nova.
  - **A linha visível MUDA por aba, e isso é o desenho**: em `Análise` é o fato (quem passa o olho leva o número embora); em `Plano` é a ação (ali se procura o que fazer). Mesmo achado, peso trocado — nunca um número diferente.
  - **O número nunca fica atrás do clique.** Esconder o fato transformaria a lista num índice de títulos, e título de achado sem número é manchete.
  - ⚠️ **Só o título vai dentro do `Accordion.Trigger`.** `<button>` aceita conteúdo de frase, não de fluxo, e texto dentro de botão é penoso de selecionar — justamente a linha que alguém quer copiar. E **nada de `<h3>` ali dentro**: `Accordion.Header` já É o heading, então um h3 aninhado sai errado para leitor de tela.
  - `type="multiple"` e o primeiro item aberto: comparar dois achados é uso normal, e lista toda fechada cobra um clique antes de qualquer leitura.
- **Descrição de card é RÉGUA, não changelog.** O que conta, a janela, a exclusão, a armadilha de leitura — em uma ou duas linhas. "A versão anterior deste card fazia X" é conversa com o revisor: vive no commit e no doc, nunca na tela.
- ⚠️ **A régua `e_cliente` é da RPC, não do mart.** Os fatos guardam todo mundo — admin, interno e teste — e quem filtra é quem lê. Auditado em 13/08: 5 de 59 RPCs de grão-cliente liam sem a régua, e o desvio ia de 2,3% (aula) a **30,8%** (consultor). Na tela de IA isso não era arredondamento: a ordem das faixas de profundidade mudou, "parou na 1ª mensagem" caiu de 3º para 5º maior. **RPC nova que toca fato de grão-cliente junta `dim_usuario` com `e_cliente` — sem exceção não declarada.**
  - `marts.fact_navegacao` é a única que **já nasce filtrada** (o filtro está na construção do fato). Quem a lê não precisa repetir a régua, e um grep por `e_cliente` a acusa como falso positivo.
  - Exceção declarada em `comment on function`: `bi_saude_rastreio` mede instrumentação, não cliente — filtrar esconderia o rastreio quebrado que só aparece no uso interno.
- **Recorte persona/plano** (contrato na seção Transversal do roadmap): filtro global `SegmentoFiltro` ao lado do período nas telas de grão cliente, estado na URL (`?papel=` e `?plano=`) e propagado pela navegação do shell via `comSegmento` — recorte é do app, não da tela. As RPCs centrais recebem `p_papel`/`p_plano` (null = todos). **Quem suprime percentual/taxa/média com denominador < 30 é o banco** (migration `20260811175116_recorte_por_persona_e_plano.sql`); a tela só declara, com `notaAmostra`. Valores, rótulos e helpers do contrato vivem em `src/lib/segmento.ts` — não duplicar lista de papéis/planos em página.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | dev server :5173 (preview via `.claude/launch.json`) |
| `npm run build` | type-check + build |
| `npm run lint` | ESLint |
| `npm run typecheck` | só type-check |
| `npm test` | Vitest — contratos de métrica e formatação pt-BR |
| `npm run db:types` | regenera types do banco |
