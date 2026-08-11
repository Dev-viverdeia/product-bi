# Discovery — Banco da plataforma de CS (Pulse)

Segunda fonte do Product BI, para o dashboard executivo do CEO. Este documento
registra o que foi **verificado no banco**, não o que foi relatado.

Base: relatório do time do Pulse (10/08/2026), conferido linha a linha contra o
banco em 11/08/2026. Os números do relatório bateram — a deriva é de um dia de
operação. O que **diverge** do relatório está marcado como tal e tem a medição
junto.

## 1. Visão geral

| | |
| --- | --- |
| Projeto Supabase | `cs_pulse_platform` — ref `tfwnxzbjfmmtskdvndcf` |
| Região | **us-east-2** (o Product BI é `sa-east-1`) |
| Postgres | 17.6 |
| Schema de interesse | `public` (~95 tabelas; usamos 21) |
| Blocos do dashboard | Atendimento · Disparos · Solicitações de cancelamento · Cancelados · Reversão · Kickoff |

**Cross-region é o motivo pelo qual o sync incremental deixa de ser preferência
e vira obrigação.** Nada de consulta ao vivo atravessando `us-east-2` →
`sa-east-1`: agregação pesada sempre no mart local, como já vale para a
plataforma.

⚠️ O banco é compartilhado com o sistema antigo (`plataforma-de-cs`) e tem um
schema `bi` volátil, que renomeia e remove colunas sem aviso. **O nosso FDW
importa tabela a tabela do `public`** — nunca o schema inteiro, nunca o `bi`.

## 2. Números-chave validados (11/08/2026)

| Objeto | Volume | Observação |
| --- | --- | --- |
| `wa_atendimento_ciclos` (view) | 2.476 ciclos | a unidade de atendimento |
| `pipeline_cancelamentos` | 266 ativas | `deleted_at is null` |
| — com `motivo` vazio | 121 (45%) | ver §5 |
| — com `justificativa` vazia | 169 (64%) | ver §5 |
| `notification_broadcasts` | 1.680 | campanha |
| `notification_logs` | 49.376 | destinatário × disparo |
| — `status = 'skipped_dedup'` | 6.828 (14%) | **não é envio** — trava anti-duplicidade |
| `pipeline_empresas` | 3.981 cards | todos os quadros |
| `pipeline_card_movimentos` | 7.290 | **desde 2026-07-08 22:00 UTC** |

## 3. Acesso — por que o bloqueio do relatório não se aplica aqui

O relatório aponta como bloqueio 🔴 que `wa_atendimento_ciclos` não é legível
pela chave pública. Confirmado nos grants:

| Papel | SELECT na view |
| --- | --- |
| `anon` | não |
| `authenticated` | não |
| `postgres` | **sim** |
| `service_role` | sim |

O SELECT foi revogado em 17/07/2026 porque a view roda com os direitos do dono
(`security_invoker = off`, confirmado) e pulava a RLS das tabelas por baixo —
qualquer um com a chave publishable listava ciclos com telefone e nome sem
login. **Não reabrir.**

Para o Product BI isso é indiferente: a arquitetura nunca lê banco de origem
pelo navegador. O `postgres_fdw` conecta servidor-a-servidor como `postgres`,
agrega para `marts`, e o app lê RPC do nosso próprio projeto. A decisão que o
relatório coloca como "(A) service_role server-side ou (B) RPC de agregação" já
está tomada por construção — somos as duas.

**Falso positivo descartado:** `anon` tem `INSERT/UPDATE/DELETE/TRUNCATE` na
view sem ter `SELECT`, o que parece `GRANT ALL` esquecido. A view **não é
auto-atualizável** (`is_updatable = NO`), então os grants são inertes. Não é
brecha.

## 4. Retenção — a régua do Product BI diverge da view da casa

A `public.v_retencao_cobranca` classifica empresa em `CANCELADO` · `REVERTIDO`
· `LEVANTOU_A_MAO` e é a régua que o Pulse usa. **Ela infla reversão.**

A cláusula de reversão da view é:

```sql
WHEN tipo_acordo IN ('revertido','downgrade')
     OR cancel_stage = 'Revertido'
     OR reversao_stage IS NOT NULL   -- ← qualquer card no quadro Reversão
THEN 'REVERTIDO'
```

A terceira condição conta como recuperada qualquer empresa com card no quadro
Reversão, **em qualquer etapa** — inclusive "Sem resposta" e "inviável", que são
perda declarada. Decomposição dos 38 que a view devolve:

| Origem da classificação | Empresas | Recuperação de fato? |
| --- | --- | --- |
| Acordo registrado (`tipo_acordo`) | 27 | sim — desfecho |
| Etapa "Revertido" do funil, sem acordo | 5 | sim — decisão humana |
| Só por ter card no quadro Reversão | 6 | **não — tentativa em curso** |

### Régua adotada (decisão do Mateus, 11/08/2026)

**Revertido = acordo de reversão OU etapa "Revertido" no funil de cancelamento.
Card no quadro Reversão, sozinho, não conta.** Resultado: **32**.

Duas diferenças deliberadas em relação à view da casa:

1. Remoção do `OR reversao_stage IS NOT NULL` do ramo de reversão.
2. `pipeline_cancelamentos` filtrado por `deleted_at is null` — a view da casa
   não filtra, e por isso conta 1 solicitação deletada.

Validado contra o banco:

| Status | Empresas | Com card no quadro Reversão |
| --- | --- | --- |
| REVERTIDO | 32 | 28 |
| CANCELADO | 123 | 7 |
| LEVANTOU_A_MÃO | 126 | 5 |

**O quadro Reversão fecha sem sobra:** 28 + 7 + 5 = 40 cards. É o teste que
prova que a régua não perde nem inventa empresa. Dos 40 em algum momento
perseguidos, 28 foram recuperados, 7 se perderam e 5 seguem em tentativa aberta
— e esse "5" é métrica própria, não vira reversão.

### Por que a regra mora no nosso mart, e não na view deles

Se a classificação vive num banco de terceiro, ela muda sem aviso e o número do
CEO muda junto, em silêncio. No `marts` ela é versionada em migration, tem teste
e qualquer alteração aparece no diff. Mesma razão pela qual `e_cliente` e o
fuso `America/Sao_Paulo` são aplicados nas nossas funções.

⚠️ Vale reportar ao time do Pulse: o dashboard interno deles usa a mesma view e
mostra os mesmos 38.

## 5. O que o banco NÃO responde

| Pergunta | Por quê |
| --- | --- |
| **Distribuição percentual dos motivos de cancelamento** | `motivo` e `justificativa` são texto livre, sem enum nem domínio; 121 de 266 vazios. Não é problema de query, é de processo. O que existe categorizado é `tipo_acordo`, que é **desfecho comercial, não motivo** — e usar um pelo outro seria mentir com número. |
| Tipo/assunto do atendimento | Não existe campo. `wa_tickets.tags` sem uso confirmado. |
| SLA/atraso em Kickoff, Cancelamento e Reversão | `pipeline_stage_sla` só está preenchido para o quadro "Jornada do cliente". |
| Data de saída de etapa | Não é coluna; só derivável do movimento seguinte, e só desde 08/07/2026. |
| Série histórica de cliques | `dispatch_link_redirects` tem purga diária. |

### Dado com prazo de validade

- **`dispatch_link_redirects` é purgado todo dia.** Taxa de clique só existe como
  série se o espelho começar a rodar — cada dia sem sync é um dia que não volta.
  Mesma armadilha da navegação da plataforma, que some com mais de 30 dias.
- **`pipeline_card_movimentos` começa em 08/07/2026.** É o único histórico de
  tempo por etapa que existe; antes disso não há nada.

## 6. Regras de contagem que mudam o número

| Métrica | Regra | Erro se ignorada |
| --- | --- | --- |
| Atendimentos | `count(distinct ticket_id)` na view de ciclos | usar `wa_messages` infla ~25× (62.954 vs 2.476) |
| Mensagens enviadas | `status = 'sent'` | incluir `skipped_dedup` infla ~14% |
| Pessoas impactadas | `count(distinct destinatário)` | `count(*)` conta envios, não pessoas |
| Atendimento por empresa | join por `wa_phone_key(telefone)` | `client_id` só tem 33% preenchido |
| Solicitações históricas | ativas + `pipeline_cancelamento_ciclos` | contar só as ativas subestima quem pediu mais de uma vez |

## 7. PII — o que espelhar

Nenhum dos 28 indicadores precisa de dado pessoal: precisa de **distinção**, que
é outra coisa. O espelho guarda a **chave normalizada**, nunca o valor:

- `wa_phone_key(phone_e164)` no lugar do telefone;
- chave derivada de `recipient_email` / `recipient_phone` nos disparos.

`count(distinct)` funciona igual sobre a chave. Ficam **fora do espelho**:
`phone_e164`, `contato`, `recipient_email`, `recipient_phone`,
`recipient_name`, `solicitante_email`, `solicitante_telefone`, `acordo_email`
e o conteúdo de `wa_messages`.

Consequência: o dashboard executivo nunca guarda dado pessoal. Não é política
aplicada por cima — é o desenho do espelho.

## 8. Pré-requisitos do FDW

1. **User mapping criado à mão pelo Mateus** no SQL editor do Product BI. A senha
   nunca entra em migration, repo ou chat — mesma regra do `plataforma_srv`.
2. **IP do Product BI liberado** no `cs_pulse_platform`. (E `54.232.250.105/32`
   restaurado no `product_viverdeia_platform`, que segue bloqueando o pipeline
   atual.)
3. **Três enums precisam de tipo local homônimo** antes do
   `import foreign schema`:

   | Enum | Valores |
   | --- | --- |
   | `wa_ticket_status` | open · pending · waiting_third_party · solved · closed |
   | `wa_thread_status` | open · closed · archived |
   | `wa_ticket_priority` | low · normal · high · urgent |

4. Host = **session pooler**, como no `plataforma_srv` (a rota direta IPv6 não
   fecha entre projetos).

## 9. Sequência recomendada

O relatório sugere começar por Kickoff e Disparos e deixar Atendimento por
último, por causa do bloqueio de acesso. **Com a nossa arquitetura esse bloqueio
não existe**, então a ordem é outra:

1. **Atendimento** — maior valor, dado limpo, unidade já modelada.
2. **Disparos** — sem ambiguidade; só respeitar `skipped_dedup`.
3. **Solicitações de cancelamento** — data, origem e funil prontos.
4. **Kickoff** — `dashboard_kickoff()` já existe como referência de regra.
5. **Cancelados** — com a régua de §4.
6. **Reversão** — funil operacional + os 5 em tentativa aberta.

**Motivos de cancelamento não entra** enquanto não houver campo categórico.
