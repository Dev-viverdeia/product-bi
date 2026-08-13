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
| **Fidelidade de VALOR coluna a coluna** | ❌ 34 linhas erradas → ✅ **CORRIGIDA em 13/08** |

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

## 5. Fidelidade de valor — auditada, com defeito achado

Juntando por `id` e comparando **coluna a coluna**, não só a contagem:

| espelho | linhas comparadas | divergentes |
| --- | ---: | ---: |
| `fact_progresso_aula` | 148.115 | 0 |
| `fact_certificado` | 10.422 | 0 |
| `fact_nps_aula` | 17.763 | 0 |
| `fact_evento` | 340.503 | 0 |
| `fact_pageview` | 363.728 | 0 |
| `fact_progresso_solucao` | 56.896 | **31** |
| `fact_convite` | 32.510 | **3** |

### O watermark não via toda mudança

As 34 divergências **não eram defasagem**. Todas as 31 de solução tinham
`completed_at` POSTERIOR a `last_activity`, e todas com `last_activity` atrás do
watermark — ou seja, mudaram antes do último sync e mesmo assim não vieram.

A causa: **a plataforma grava `is_completed`/`completed_at` sem tocar em
`last_activity`, e grava `used_at` sem tocar em `updated_at`.** O sync lê
incremental por essas colunas, então a mudança fica invisível para sempre: o
watermark já passou daquele ponto e nunca volta.

É a mesma família do defeito de exclusão — **o incremental só enxerga o que a
origem se lembra de carimbar**. Eram 31 conclusões de solução reais, todas entre
07 e 13/08/2026, faltando numa métrica central do produto.

### A correção (migration `20260813210000`)

Duas frentes, de propósito:

1. **Fechar a chave incremental** com `greatest(...)` sobre todas as colunas que
   mudam — resolve o que foi descoberto, em 30 min em vez de um dia.
2. **`etl.reconciliar_valores()`**, no pg_cron diário às 04:20 BRT — pega o que
   não foi descoberto e o que a plataforma inventar depois. Não apaga nada, só
   atualiza linha existente nos dois lados, então origem vazia produz zero
   atualizações em vez de estrago. É por isso que este passo não precisa da guarda
   de sanidade que `propagar_exclusoes` exige.

**Resultado:** 35 linhas corrigidas. Re-auditoria depois: **237.605 linhas
comparadas, zero divergência.**

## 6. A régua `e_cliente` na camada de leitura — corrigido em 13/08

Auditado em 13/08 e **este é de outra camada**: o dado bruto está certo, quem não
estava é a RPC que o lê. As cinco foram corrigidas (migration `20260813213000`).

Das 108 funções `bi_*`, 59 tocam fato de grão-cliente e **14 não mencionam
`e_cliente`**. Investigando o que cada uma lê:

- **8 são falso positivo** — leem `marts.fact_navegacao`, que **já nasce
  filtrada** (377.541 linhas brutas = 377.541 com a régua, 100%). O filtro está
  embutido na construção do fato.
- **Zero leem `fact_pageview` cru**, que seria o pior caso (13,7% de não-cliente).
- **6 leem outros fatos sem a régua**, e aí o desvio é real:

| fato | inflado por não-cliente |
| --- | ---: |
| `fact_progresso_aula` | 2,3% |
| `fact_progresso_solucao` | 8,6% |
| `fact_evento` | 11,4% |
| `fact_consultor_thread` | **30,8%** |

⚠️ **Quase um terço do uso do Consultor é admin/interno/teste** — o time testa a
própria ferramenta de IA. `bi_ia_modo_de_entrada` e `bi_ia_profundidade_conversa`
leem esses fatos sem a régua, então os números da tela de IA estão inflados nessa
ordem de grandeza.

`bi_saude_rastreio` está na lista e **é exceção legítima**: ela mede saúde de
instrumentação, e filtrar por cliente esconderia justamente o rastreio quebrado
que só aparece no uso interno. Ficou declarada em `comment on function`.

### O efeito não foi cosmético

Em `bi_ia_profundidade_conversa` o total caiu de **9.507 para 6.580** conversas —
e a **ordem das faixas mudou**:

| faixa | antes | depois |
| --- | ---: | ---: |
| Cinco a dez | 29,5% (1º) | 29,2% (1º) |
| Três a quatro | 27,7% (2º) | 24,7% (2º) |
| **Parou na 1ª mensagem** | **15,6% (3º)** | **13,4% (5º)** |
| **Duas mensagens** | **14,4% (4º)** | **17,5% (3º)** |
| Mais de dez | 11,0% (5º) | 13,5% (4º) |

A tela contava o teste do time como comportamento de cliente, e isso **invertia a
leitura de onde a conversa morre**: "parou na primeira mensagem" parecia o
terceiro maior problema e é o quinto.

Em `bi_ia_modo_de_entrada` o efeito foi menor e não mudou a direção: chat caiu de
47,7% para 46,1% de volta, planejamento de 37,8% para 36,5% — a vantagem do chat
segue, com quase a mesma distância.

⚠️ A migration termina purgando `insights.achado_cache` das quatro telas
afetadas. O conjunto de regras não entra na chave do cache, então sem a purga a
tela serviria o texto antigo sem erro nenhum, citando um número que o card ao
lado não mostra mais. Verificado depois: o motor recalcula as quatro sem erro,
15 achados, nenhum suprimido.

## 7. O que ainda não foi auditado

Registrado para não passar por verificado:

- **`fact_navegacao`** não tem contrapartida direta na origem para reconciliar
  linha a linha (é derivada: sessão, ordem na sessão, próxima tela). O que foi
  verificado é que a régua está embutida nela.
- **As colunas fora do núcleo** de cada fato — comparei as que sustentam métrica
  (chave, data, flag, valor), não toda coluna espelhada.
- **`analytics`** — por decisão do Mateus, fica com ele na plataforma.
