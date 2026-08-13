# Auditoria da extração — estamos puxando certo?

Medido em **13/08/2026**, reconciliando origem contra espelho tabela a tabela.
A pergunta não é "que dado existe" (isso é `auditoria-do-dado-bruto.md`), é
**"o que puxamos reflete a origem?"**.

Método: contar os dois lados na mesma consulta. O FDW expõe `plataforma.*` e
`pulse.*` dentro do BI, então origem e espelho são comparáveis sem exportar nada.

---

## Veredito

| dimensão da extração | resultado |
| --- | --- |
| CS (Pulse) — fidelidade | ✅ **exata** |
| Conversão de fuso (`*_brt`) | ✅ **correta** em todas as testadas |
| Watermark / frescor | ✅ rodando, última carga há minutos |
| Arquivo de navegação | ✅ funcionando por desenho |
| **Propagação de exclusão nos fatos da plataforma** | ❌ quebrada → ✅ **CORRIGIDA em 13/08** |

---

## 1. O CS está exato

| par origem → espelho | origem | espelho | diferença |
| --- | ---: | ---: | ---: |
| `cancelamentos` → `fact_cs_cancelamento` | 276 | 276 | **0** |
| `pipeline_cards` → `fact_cs_card` | 6.592 | 6.592 | **0** |
| `pipeline_movimentos` → `fact_cs_movimento` | 10.919 | 10.919 | **0** |
| `cliente_status_diario` → `fact_cs_status_diario` | 10.419 | 10.419 | **0** |
| `atendimento_tickets` → `fact_cs_atendimento` | 2.534 | 2.533 | −1 |

O −1 é um ticket aberto depois da última carga (o ciclo é de 30 min), não perda.

## 2. O fuso está certo

`data_brt` e `hora_brt` conferem com a conversão real para `America/Sao_Paulo`
em **437.566 linhas** de `fact_pageview` e **343.652** de `fact_evento`: zero
divergência. Em `fact_cs_cancelamento`, zero também.

⚠️ **Armadilha de auditoria registrada:** a primeira medição acusou 270 de 276
cancelamentos com fuso errado. Era falso — `solicitado_em_brt` é `date` e eu
comparei com `timestamp`. Quem repetir esta auditoria tem que comparar no mesmo
tipo, senão gera alarme onde não há defeito.

(6 cancelamentos têm `solicitado_em` nulo na própria origem — é lacuna do Pulse,
não da extração.)

## 3. O espelho como arquivo funciona

`fact_pageview` tem **437.566** linhas contra **363.808** na origem. A diferença
de +73.758 **não é defeito, é o propósito**: a plataforma purga navegação com mais
de 30 dias e o BI guarda. São 42 dias aqui contra 34 lá.

## 4. Exclusão não propagava nos fatos — corrigido em 13/08/2026

**13 clientes foram apagados da plataforma.** A dimensão fez o certo — nenhum
deles permanece em `marts.dim_usuario`. Os fatos não:

| espelho | linhas de apagados | clientes | período |
| --- | ---: | ---: | --- |
| `fact_progresso_aula` | 291 | 10 | 04/03 → 04/08/2026 |
| `fact_nps_aula` | 65 | 7 | 04/03 → 17/07/2026 |
| `fact_progresso_solucao` | 36 | 9 | 06/03 → 22/07/2026 |
| `fact_certificado` | 28 | 8 | 04/03 → 04/08/2026 |
| `fact_convite` | 18 | — | — |
| **total** | **438** | **13 distintos** | |

Duas consequências, as duas reais:

**(a) Contrato de PII violado.** A disciplina 3 do contrato diz "exclusão
propaga — se a plataforma apaga alguém, o mart apaga junto", e registra que
guardar quem a origem excluiu é *o único ponto em que espelhar amplo vira risco
real, independentemente de autorização*. Estamos guardando atividade de 13 pessoas
que pediram para sumir.

**(b) Duas contas divergentes sobre o mesmo fato.** Em `fact_progresso_aula` há
**629 linhas de 43 `user_id` que não existem na dim**. Uma RPC que junta
`dim_usuario` devolve 148.115; uma que conta o fato direto devolve 148.744. É
exatamente o defeito que a régua da casa proíbe — o mesmo número com dois valores
dependendo de quem pergunta.

> Os 43 são mais que os 13 apagados: o restante são `user_id` que nunca entraram
> na dim. Investigar na correção — pode ser usuário de outro tenant ou linha
> anterior ao recorte da dimensão.

### O escopo real era 10× maior que o primeiro diagnóstico

Antes de escrever a correção fui investigar os 30 `user_id` fantasma que pareciam
não ser exclusão. **Eram todos exclusão** — os 43 sumiram de `profiles`. Mas 33
deles **ainda tinham linha na origem**: a plataforma apagou o perfil e deixou a
atividade órfã no banco dela.

Isso invalidou a correção que eu tinha proposto. Reconciliar só por chave teria
limpado 438 das 4.662 linhas e eu teria declarado o problema resolvido.

Contagem final do que estava exposto: **211 pessoas apagadas, 4.662 linhas.**

| espelho | linhas de pessoa apagada |
| --- | ---: |
| `fact_evento` | 3.149 |
| `fact_progresso_aula` | 629 |
| `fact_pageview` | 524 |
| `fact_nps_aula` | 222 |
| `fact_progresso_solucao` | 110 |
| `fact_certificado` | 28 |

### A correção (migrations `20260813203000` e `20260813204500`)

`etl.propagar_exclusoes()` apaga por **dois critérios**, não um:

- **por pessoa** — a linha é de alguém que não existe mais em `plataforma.profiles`
- **por chave** — o `id` não existe mais na origem

O critério de chave **não se aplica a pageview e navegação**: a plataforma purga
navegação com mais de 30 dias e o BI guarda de propósito. Aplicá-lo ali apagaria
justamente o arquivo que é o nosso maior valor.

⚠️ **Guarda de sanidade, que não é zelo excessivo.** Toda a lógica apaga com base
em "não existe na origem". Se o FDW cair, se a credencial expirar ou se a consulta
remota voltar vazia, "não existe" vira verdade para TODAS as linhas e a função
apaga os marts inteiros — em silêncio, dentro do cron, de madrugada. A função
aborta se `profiles` vier com menos de 90% do tamanho da dim.

**Resultado da execução:** 4.680 linhas removidas (4.662 por pessoa, 18 por
chave). Verificado depois: **zero** linhas de pessoa apagada em qualquer mart, e a
divergência de contagem fechou — `fact_progresso_aula` devolve 148.115 com e sem o
join com a dim, contra 148.744 × 148.115 antes.

**O que impede a volta:**

1. `bi_propagar_exclusoes` no pg_cron, **diário às 04:10 BRT** — não a cada 30
   min: é varredura de conjunto contra o FDW, e exclusão de conta não é evento de
   minuto.
2. `marts.contar_linhas_de_apagados()` — deve devolver zero. Qualquer valor acima
   é o passo falhando em silêncio, que é exatamente como o problema nasceu.

## 5. O que ainda não foi auditado

Registrado para não passar por verificado:

- **Fidelidade de VALOR**, não só de contagem. Confirmei que o número de linhas
  bate; não confirmei coluna a coluna que o conteúdo bate. O risco real aqui é
  transformação silenciosa no sync (um `coalesce`, um cast, um filtro).
- **`fact_navegacao`**, que é derivada (sessão, ordem na sessão, próxima tela) e
  não tem contrapartida direta na origem para reconciliar por contagem.
- **A régua `e_cliente`** aplicada por RPC. Sei que a dim carrega o campo; não
  auditei se todas as RPCs o usam.
- **`analytics`** — por decisão do Mateus, fica com ele na plataforma.
