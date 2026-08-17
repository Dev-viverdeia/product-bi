# Reporte: rastreamentos quebrados na plataforma

**Para:** time da plataforma Viver de IA
**De:** Product BI
**Data:** 07/08/2026 · todos os números reconferidos nesta data, direto na origem

Durante a construção do BI, ao validar cada fonte antes de usá-la, encontramos
**seis rastreamentos parados ou incorretos** no banco da plataforma. Nenhum
deles derruba a aplicação — por isso passaram despercebidos —, mas todos
corrompem análise de produto e alguns escondem dinheiro.

O achado mais importante não é um bug isolado: **três deles pararam no mesmo
dia**, o que sugere uma causa raiz única.

---

## 🔴 Prioridade 1 — Três integrações pararam juntas em 19/abr/2026

| Tabela | Última linha | Dias parada |
| --- | --- | --- |
| `hubla_webhooks` | 19/04/2026 | 110 |
| `webhook_logs` | 19/04/2026 | 110 |
| `invite_deliveries` | 19/04/2026 | 110 |

As três pertencem ao subsistema de **webhooks / integrações externas**. Pararem
no mesmo dia aponta para uma causa comum — Edge Function derrubada, credencial
ou endpoint alterado, deploy que removeu um handler, ou mudança de configuração
no provedor.

**Sugestão de investigação:** o que mudou na plataforma em 18–19/abr/2026?
(deploy, rotação de secret, alteração de webhook na Hubla, quota de Edge Function)

**Impacto no negócio:**

- **Receita cega há 110 dias.** `hubla_webhooks` é a única fonte de pagamento no
  banco. Sem ela não há receita, LTV, reembolso ou falha de cobrança a partir de
  abr/2026. Para dimensionar: no período que temos (ago/2025–abr/2026) foram
  **R$ 626.535 aprovados** e **R$ 496.737 em pagamentos que falharam** — é esse
  tipo de número que está invisível hoje.
- **Entrega de convite cega.** Os convites continuam sendo criados normalmente
  (4.524 nos últimos 30 dias) e `invite_delivery_events` segue registrando o
  `sent`, mas o detalhe por convite (canal, status, falha de envio) morreu.

### Bônus do mesmo diagnóstico

`invite_deliveries.opened_at` e `.clicked_at` **nunca foram preenchidos** —
0 de 7.723 linhas, desde sempre. Não é regressão: o rastreamento de abertura e
clique de convite nunca chegou a funcionar. Enquanto isso, não dá para medir a
eficácia do e-mail de convite, só a conversão final.

---

## 🔴 Prioridade 2 — `solution_started` parou e quebrou o funil de Soluções

`user_activity_tracking.activity_type = 'solution_started'` não é emitido desde
**23/06/2026** (45 dias). O agravante: `solution_viewed` e `solution_completed`
continuam funcionando normalmente — então o funil tem começo e fim, mas perdeu o
meio.

**Impacto medido** (comparando com os inícios reais na tabela `progress`):

| Mês | Inícios reais | Eventos emitidos | Não rastreados |
| --- | --- | --- | --- |
| abr/2026 | 6.412 | 3.608 | 2.804 |
| mai/2026 | 7.615 | 7.734 | ~0 |
| jun/2026 | 10.944 | 6.549 | 4.395 |
| **jul/2026** | **13.806** | **0** | **13.806** |
| ago/2026 (parcial) | 2.445 | 0 | 2.445 |

**16.251 inícios de solução sem evento** desde julho — e note que o uso está
*crescendo* (6,4 mil em abril → 13,8 mil em julho). O evento morreu exatamente
quando o produto mais foi usado.

No BI contornamos lendo a tabela `progress` diretamente, mas qualquer análise
que dependa do evento (inclusive dentro da própria plataforma) está errada.

---

## 🟠 Prioridade 3 — View `bi_receita_hubla` lê um caminho que não existe

A view usa:

```sql
((payload -> 'invoice') -> 'amount') ->> 'totalCents'
```

Mas a estrutura real do payload da Hubla é:

```sql
(((payload -> 'event') -> 'invoice') -> 'amount') ->> 'totalCents'
```

Falta o nível `event`. **Verificado: `select count(*) from bi_receita_hubla`
retorna 0.** Toda análise de receita/LTV feita com essa view — e com as que
dependem dela, como `bi_ltv_cohort` — está vazia ou zerada.

Corrigindo o caminho, os dados aparecem: 236 faturas pagas, R$ 626.535,
103 compradores, ticket mediano R$ 1.791,67.

---

## 🟡 Prioridade 4 — Outros dois rastreamentos parados

| Tabela | Última linha | Dias parada | Observação |
| --- | --- | --- | --- |
| `referral_events` | 11/03/2026 | 149 | a tabela `referrals` está vazia desde sempre — o programa de indicação não tem medição |
| `email_queue` | 08/05/2026 | 91 | fila de e-mail com fallback/retry; pode indicar que o envio migrou de caminho, ou que a fila parou de ser usada |

`user_activity_tracking.connection_accepted` também não é emitido desde
05/05/2026 (94 dias), mas o volume histórico é baixo (150 no total) — vale
conferir junto do módulo de networking, sem urgência.

---

## O que já ajustamos no BI (não precisa esperar a correção)

| Problema | Contorno adotado |
| --- | --- |
| `solution_started` morto | funil de Soluções lê `progress`, não o evento |
| View de receita quebrada | `marts.fact_fatura` usa o caminho correto do JSON |
| Entrega de convite parada | funil de entrada vai direto de "convite criado" para "cadastro" |
| Eventos com datas de início diferentes | cada análise declara sua janela; retenção usa só a régua estável |

Todas as telas do BI que dependem de fonte limitada trazem o aviso visível, para
ninguém tirar conclusão errada.

---

## Por que isso importa além do BI

Estes rastreamentos não servem só para relatório: são a base para decidir o que
construir, o que cortar e onde investir. Com eles quebrados:

- não dá para saber se uma mudança de produto melhorou ou piorou a conversão;
- não dá para agir sobre pagamentos que falharam (havia R$ 496 mil no período
  medido);
- não dá para avaliar o programa de indicação nem a eficácia dos convites.

**Sugestão:** tratar a Prioridade 1 como uma investigação única (o que mudou em
19/abr) em vez de três bugs separados — a probabilidade de ser a mesma causa é
alta, e a correção provavelmente ressuscita as três de uma vez.

Se ajudar, o BI consegue confirmar em minutos se a correção funcionou: basta
olhar se as tabelas voltaram a receber linhas.

---

## Adendo — reconferência em 17/08/2026

O corpo acima é a carta de 07/08 e fica como está. Esta é a releitura de dez
dias depois, direto na origem: **cinco dos seis continuam parados, e um voltou
sozinho.**

| Rastreamento | Estado em 17/08 |
| --- | --- |
| `hubla_webhooks` — parou em 19/04 | ⛔ continua · 3.533 linhas, última 19/04/2026 |
| `webhook_logs` — parou em 19/04 | ⛔ continua · 11 linhas, última 19/04/2026 |
| `invite_deliveries` — parou em 19/04 | ⛔ continua · 7.723 linhas, última 19/04/2026 |
| `solution_started` — parou em 23/06 | ⛔ continua · 17.891 eventos, último 23/06. `solution_viewed` (136.697) e `solution_completed` (2.151) seguem ativos — só o meio do funil morreu |
| `referral_events` — parou em 11/03 | ⛔ continua · 8.533 linhas, última 11/03/2026 |
| `email_queue` — parou em 08/05 | ✅ **voltou** · 5.164 linhas, última 17/08/2026. Ficou sem nenhuma linha em junho e julho e voltou em agosto com 1.317 |

**A Prioridade 1 segue intacta** — as três de 19/04 não se mexeram, e a hipótese
de causa única continua valendo.

Dois itens novos, que não estavam na carta e valem entrar se ela for reenviada:

- **`learning_lesson_nps` parou em 29/07/2026** (17.912 linhas). Conferido que é a
  coleta na origem, não o nosso pipeline: o FDW está de pé e o sync roda com zero
  linha nova porque não há linha nova lá.
- **`fact_progresso_aula` grava só conclusão** — `pct = 100` em 98,6% das linhas.
  Isso esvazia qualquer métrica de "% de conclusão de aula", que é pergunta
  central do produto: não dá para saber onde o aluno parou, só se ele terminou.
