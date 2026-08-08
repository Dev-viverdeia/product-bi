# Auditoria de dados — 08/ago/2026

Varredura completa das 9 telas de produto: integridade dos marts, correção das
métricas contra os contratos do roadmap e cobertura do escopo prometido.

Método: comparação mart × dimensão (órfãos, duplicatas, cobertura temporal),
leitura do corpo de todas as 61 RPCs, execução de todas elas com conferência da
saída, varredura automática de colunas mortas em todas as tabelas de `marts`, e
conferência item a item das tabelas do roadmap.

---

## 1. O que está certo

- **61 RPCs no banco, 61 consumidas pelo app** — nenhuma órfã, nenhuma
  referência quebrada.
- **Todas as 56 RPCs de dados retornam linhas** — nenhuma tela vazia.
- **Contratos de métrica conferem com o roadmap**: churn = 60d sem atividade ·
  risco = 14d de silêncio após 60d ativo · aha = ações em 7d → retenção em
  [90,120) · retido em Xd = ativo na janela [X, X+30d).
- **Régua da Entrega 8 (Jornada & Telas) estava correta** — a suspeita inicial
  de contaminação era falso positivo: `etl.sync_fact_navegacao()` já aplica
  `e_cliente` ao montar o mart, então as 6 RPCs que leem `fact_navegacao`
  herdam a régua. Contaminação medida: 0,0%.
- **Órfãos nos fatos são contas deletadas na plataforma**, não falha de sync:
  219 usuários, espalhados por todos os meses (sem pico no mês corrente), e
  `sync_dim_usuario` é full refresh de `profiles`. O inner join com a dimensão
  já os exclui.
- **`bi_receita_kpis` sinaliza a própria defasagem** (`dados_ate 18/abr/2026`),
  coerente com o webhook da Hubla que parou — já reportado ao time da
  plataforma em `reporte-rastreamentos-quebrados.md`.

---

## 2. Defeitos encontrados e corrigidos

### 2.1 `fact_pageview.solution_id` é 100% nulo — coluna morta na tela ⚠️ grave

0 de 383.188 pageviews têm `solution_id`. A plataforma não preenche a coluna; o
discovery supunha que sim ("+ `solution_id`/`module_id` quando a rota é de
solução" — otimista, não verificado à época).

Efeito: a coluna **Pageviews** aparecia em duas tabelas da tela de Soluções
(*Candidatas a remoção* e *Ranking*) exibindo **0 em todas as linhas**, com a
legenda "pageviews desde jul/2026" — que fazia o zero passar por dado real
("ainda tem pouco histórico") em vez de campo quebrado. Pior tipo de defeito num
BI: número falso com aparência de número verdadeiro.

Além disso, o critério "sem acesso" de *Candidatas a remoção* (Entrega 5 do
roadmap) simplesmente não estava sendo medido, e havia um índice
(`fact_pageview_solucao_idx`) sobre uma coluna sempre nula.

**Corrigido**: coluna fora da view, das RPCs e da tela; índice removido.

**O dado existe** — está no `path` (`/solucoes/<slug>`). Recuperar exige o slug
oficial de `plataforma.solutions` na `dim_solucao`; casar por normalização do
título recupera 89,6%, o que é frágil demais para entrar em produção.
Pendência registrada em §4.

### 2.2 Régua `e_cliente` aplicada de forma inconsistente

31 RPCs aplicavam a régua, 28 não. Parte das exceções é legítima (o funil de
entrada mede, por definição, quem ainda não é cliente). O resto era
inconsistência — inclusive **dentro da mesma tela** e, em `v_metricas_solucao`,
**dentro da mesma linha** (`iniciadas` com régua, `nota`/`favoritos` sem).

Volume interno medido por fonte:

| Fonte | Não-cliente |
| --- | --- |
| `fact_builder_solucao` | 21,8% |
| `fact_pageview` | 13,2% |
| `fact_progresso_solucao` | 8,6% |
| `fact_avaliacao_solucao` | 7,7% |
| `fact_aba_implementacao` | 4,0% |
| `fact_nps_aula` | 2,6% |
| `fact_progresso_aula` | 2,5% |
| `fact_certificado` | 1,6% |

**Corrigido** em: `v_metricas_solucao` (nota e favoritos),
`bi_solucoes_por_categoria`, `bi_duracao_ideal`, `bi_dropoff_posicao`,
`bi_jornada_cursos`, `bi_nps_cursos`, `bi_builder_steps`.

Impacto na decisão: baixo onde foi medido — no Builder o volume cai 9% mas a
taxa de erro vai de 0,27% para 0,24%. O ganho é de **consistência**: dois
números sobre o mesmo assunto na mesma tela não podem contar populações
diferentes.

### 2.3 Degrau de instrumentação na tela principal ⚠️ grave

`bi_visao_geral_kpis` e `bi_atividade_diaria` definiam "ativo" como **evento OU
pageview**. Como o pageview só existe desde **03/07/2026**, isso produzia:

- **Série de 90 dias com degrau de 341 → 735 ativos/dia (+116%)** em 03/07 — no
  gráfico principal da tela principal, a base de usuários parecia dobrar. Era o
  rastreamento nascendo, não crescimento.
- **KPI "Usuários ativos +33,5%"** e **"Pageviews +313,3%"**: a janela atual
  tinha 30 dias instrumentados, a de comparação tinha 6.
- **Divergência entre telas**: 5.457 ativos na Visão Geral contra 3.451 em
  Clientes/Retenção — mesmo conceito, dois números.

O contrato do roadmap já dizia "Ativo (dia) = cliente com ≥1 evento de domínio
no dia", e a régua já alertava que "deltas longos de navegação refletem
instrumentação". A implementação não seguia nem um nem outro.

**Corrigido**: "ativo" passa a ser `fact_evento` apenas (estável desde
mai/2025), o que alinha a Visão Geral com Clientes/Retenção. Pageview segue
como KPI próprio — é métrica de navegação legítima — mas **sem comparativo**
quando a janela anterior antecede o início do rastreio (a RPC devolve `null` e
a UI omite o delta em vez de mostrar 0%).

Depois: ativos 3.451 (+0,1% real) · série de 90 dias sem degrau (341 → 332) ·
Pageviews sem delta falso.

### 2.4 Funil de Soluções passava de 100% em 90 dias ⚠️ grave

Mesma causa raiz da 2.3, em outra tela. As etapas 1 e 2 do funil ("Abriu o
catálogo", "Abriu alguma solução") vêm de `fact_pageview`; as etapas 3 e 4
("Iniciou", "Concluiu") vêm de `fact_progresso_solucao`. Com o filtro de 90
dias, o pageview cobria só 36 dias reais e o progresso cobria os 90 — o funil
ficava **impossível**:

| Etapa | Antes (90d) | Depois (90d) |
| --- | --- | --- |
| Abriu o catálogo | 3.607 · 100% | 3.607 · 100% |
| Abriu alguma solução | 2.457 · 68,1% | 2.457 · 68,1% |
| **Iniciou uma solução** | **4.061 · 112,6%** ❌ | 2.274 · 63,0% |
| Concluiu uma solução | 469 · 13,0% | 113 · 3,1% |

**Corrigido**: a janela é recortada no início do rastreio, de forma que as 4
etapas cubram sempre o mesmo período; a RPC devolve `desde` e a tela informa a
data real ("desde 3 de jul, quando a navegação passou a ser rastreada") em vez
de prometer 90 dias que não existem.

### 2.5 Falha do pipeline era silenciosa (corrigido antes da auditoria)

`etl.executar_sync()` gravava o log de erro dentro do bloco `exception` do
PL/pgSQL — subtransação já revertida, log descartado junto. O pipeline ficou
17h parado sem deixar rastro. Corrigido com `etl.executar_passo()`, que isola
cada passo e grava o erro na transação externa, mais a faixa de aviso
`AlertaPipeline` no shell do app.

---

## 3. Achados que não são bug do BI

Campos que a **plataforma** não preenche (varredura de colunas mortas em todos
os marts). Nenhum chega à tela como número falso, mas limitam análise:

| Campo | Estado | Efeito |
| --- | --- | --- |
| `fact_builder_solucao.completa` | `false` nas 6.744 linhas | `is_complete` nunca é marcado na origem — não dá para medir conclusão do Builder. Não usado em nenhuma RPC. |
| `fact_credito_mentoria.grupo_*`, `estrategico_usado` | zero em todas as 671 | crédito de grupo e estratégico sem movimento algum |
| `dim_organizacao.team_limit` | nulo em 76% (1.598 de 2.101) | *Ocupação de assentos* joga 1.394 orgs em "Sem limite definido" — a maior fatia do gráfico não informa nada |
| `master_snapshot.snapshot_em` | valor único | o sync substitui tudo: não há série histórica, então "tendência por org" (Entrega 7) não é calculável hoje |

**Insight de negócio que saiu daqui**: o pool de mentoria das organizações tem
**13.332 créditos disponíveis e 9 usados** (0,07%). Valor contratado
praticamente não consumido — churn silencioso, exatamente o que a Entrega 7 se
propôs a achar.

---

## 4. A causa da parada do pipeline

Não era a senha do banco, como se suspeitou a princípio. O projeto da
**plataforma** tinha restrição de rede liberando **um único IP**
(`72.60.154.220/32`); o BI sai por `54.232.250.105` e era recusado na camada de
rede, antes de qualquer autenticação — daí `EADDRNOTALLOWED` e não `28P01`.

Liberado o IP, o pipeline voltou: 20/20 passos com sucesso, defasagem zerada.

⚠️ O IP de saída do BI não é dedicado — é da infraestrutura do Supabase em
sa-east-1 e pode mudar em manutenção. Se mudar, o pipeline para do mesmo jeito;
a diferença é que agora o alerta avisa em até 30 min, em vez de 18h.

## 5. Integridade mart × origem (verificada com o FDW de volta)

| Par | Mart | Origem |
| --- | --- | --- |
| `dim_usuario` ← `profiles` | 14.847 | 14.847 ✅ |
| `dim_solucao` ← `solutions` | 167 | 167 ✅ |
| `dim_organizacao` ← `organizations` | 2.101 | 2.101 ✅ |
| `fact_certificado` ← `learning_certificates` | 10.025 | 10.025 ✅ |

As demais tabelas diferem em unidades por serem produção viva (linhas nascendo
entre o sync e a conferência).

## 6. Pendências

Resolvidas nesta rodada, depois que o FDW voltou:

- ✅ **Pageviews por solução** — `slug` entrou na `dim_solucao` e a contagem
  casa `path = '/solucoes/' || slug`. Determinístico, sem heurística. Cobertura
  84,7%; o resto são soluções que não existem mais (excluídas corretamente) e
  12 slugs de renomeação (2,7%, perda conhecida). Coluna de volta nas duas
  tabelas e critério "Sem acesso e sem uso" ativo em *Candidatas a remoção*.
- ✅ **`dim_usuario` agora espelha remoções** — 2 contas fantasmas (ambas
  marcadas como cliente) saíram. O delete tem trava: aborta se a origem
  devolver menos de 90% do tamanho do mart, para que uma leitura parcial nunca
  esvazie a dimensão de que o BI inteiro depende.

Em aberto:

1. **`implementation_requests` (114 linhas) não está espelhada** — é a fonte de
   "pedidos de implementação paga", item de *Qualidade* na Entrega 5 que ficou
   sem cobertura.
2. **Engajamento pré-renovação (Entrega 9)** — sem RPC. Depende de inventariar
   `renewal_logs`, que o discovery não chegou a contar.
3. **"Onde a implementação trava" não é monotônico**: Checklist (10,6%) aparece
   entre Vídeo (50,7%) e Comentários (25,7%). A ordem é a sequência temporal
   real, mas apresentada como "% do topo" o leitor lê como funil e conclui que
   está errado. Rever na passada visual.
