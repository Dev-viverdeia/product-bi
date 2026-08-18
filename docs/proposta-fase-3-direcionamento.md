# Proposta — Fase 3: o BI como ferramenta de direcionamento

Documento de decisão, aberto em 17/ago/2026 a partir da visão que o Mateus declarou nesta data.
Sucede `proposta-fase-2-profundidade.md`, que segue valendo para tudo que ela decidiu — este
documento **não a substitui**, amplia o escopo dela.

**Nada vira código antes do OK do Mateus, fase a fase.**

## Convenção de verificação

O levantamento que sustenta este documento rodou em 13 agentes, com conferência adversarial em
cima de cada número (7 afirmações caíram só na frente de débito técnico). Além disso, **os números
marcados [conferido] foram remedidos diretamente no banco durante a redação**, um a um — porque a
primeira versão desta análise repetiu o roadmap em vez de consultar o banco e errou feio (ver
"Correções ao próprio registro", abaixo).

O que não tem a marca vale como pista, não como fato.

---

## 1. A visão, nas palavras do Mateus

> Esse projeto conecta na plataforma do Viver de IA, e na plataforma PULSE que é a de CS, que
> envolve cancelamento, chat dos usuários etc. Quero que essa plataforma seja o BI da plataforma
> que vai dar literalmente todos os insights, dados brutos e direcionamento que precisamos ter.
> Preciso saber se uma solução está performando, formação, builder, consultor, o que os usuários
> mais usam, organizações, convites, tempo do usuário, quais telas mais assistidas etc. Com isso,
> precisamos que a própria plataforma diga para a área de produto onde estamos acertando e
> errando, e o plano de ação que deve ser tomado.
>
> A plataforma é vendida para empresários/empresas que querem colocar IA no negócio deles. A conta
> é gerada por um convite de master user, que pode convidar várias pessoas para sua organização.
> Tenho um débito técnico de organizações antigas possivelmente sem planos, masters sem org etc.
> Isso não deve ser levado em consideração nos dados.
>
> Preciso conectar a jornada toda: saber qual formação tirar do ar, por exemplo. Um usuário entrou
> na plataforma, assistiu x, y, e pediu cancelamento — se isso acontece com esse 'path' com
> frequência, pode ser que aquilo não esteja performando. Outro caminho levou ao sucesso do
> cliente. Preciso de um nível de análise de cima muito grande, além de todos os dados brutos.

## 2. A arquitetura de três camadas

Proposta do Mateus na mesma conversa: **dados brutos · análises · plano de ação**.

> ✅ **Reconfirmada por ele em 18/ago/2026**, nas palavras dele: "pensei em três seções principais, para visualizar
> da melhor forma — uma com os dados brutos mesmo, outra de ANÁLISES desses dados, você analisando, e outra de plano
> de ação". O desenho abaixo (módulos como navegação, camadas como gramática de aba) segue valendo e **não foi
> reaberto** — a única decisão dele que muda alguma coisa aqui continua sendo a da camada de análise redigida por
> modelo, listada em §7.8.

Ela é boa, e não é uma reorganização de menu — é a mesma escada de profundidade que o projeto já
tem como metadado de card, agora virando arquitetura. Cada camada passa a ter um **contrato de
quanto pode afirmar**:

| Camada | O que ela é | O que ela NÃO pode fazer |
| --- | --- | --- |
| **Dados** | o fato, com a régua declarada e o corte visível | afirmar significado |
| **Análise** | a leitura do fato: comparação, diagnóstico, o que não dá para afirmar | inventar número que a camada de dados não mostra |
| **Plano de ação** | a alavanca, sobre quem, com histórico e reincidência | prometer efeito atribuível — não existe experimentação (§5) |

### Onde cada uma mora — a decisão que muda o desenho

**Se as três virarem navegação de topo, o link "ver o gráfico que sustenta" passa a atravessar
seções.** Esse link é o que amarra a frase ao número, e hoje é um clique dentro do módulo. Perder
isso desfaz a garantia central do motor de achados.

Proposta:

- **Os dez módulos continuam sendo a navegação principal.** As três camadas viram a gramática de
  aba dentro de cada um: **`Análise` · `Gráficos` · `Dados`**. A aba `Análise` já existe e já é a
  padrão; `Dados` é a novidade.
  - ⚠️ **Correção (18/ago): a primeira versão deste documento dizia que `Dados` "nasce barata porque
    cada card já declara qual RPC o alimenta". Isso é falso** — conferido no código: `ChartCard` e
    `TabelaCard` aceitam `id`, `nivel`, `icon`, `headline` e `description`, e **nenhuma prop de
    fonte**. O vínculo card→RPC existe só dentro do `queries.ts` de cada feature, e o casamento entre
    um card e a consulta que o alimenta é feito a olho. São **93 RPCs distintas** chamadas por 10
    módulos (CS 13 · Clientes 12 · Entrada 10 · Formações 9 · IA 9 · Jornada 9 · Organizações 8 ·
    Soluções 8 · Visão Geral 8 · Receita 5). A camada de dados precisa **primeiro** de uma declaração
    de fonte no card — que é a mesma peça que destrava "ver o dado que sustenta este gráfico".
- **`Plano de ação` vira seção de topo**, porque é a única genuinamente transversal — "onde estamos
  acertando e errando" não é pergunta de um módulo. Hoje o motor é cego entre telas **por contrato
  de CI** (`contrato-do-motor.test.ts`), e é essa camada que quebra a cegueira.
- **`Explorar` também de topo**, para o catálogo que atravessa os marts inteiros — o dado que não
  pertence a módulo nenhum.

### Duas consequências que precisam de decisão

**A camada de análise e o modelo de linguagem.** O Mateus descreveu a camada do meio como "análises
desses dados, você analisando". Hoje o achado é **calculado, sem modelo no caminho**, e a razão está
no CLAUDE.md: número que vai para a tela não pode ser inventado. Se a camada passar a ser redigida,
o desenho obrigatório é: **o calculador produz o número, a régua e o corte; o modelo apenas redige,
nunca calcula e nunca escolhe o limiar.** É a Fase 6 que a proposta anterior marcou como opcional.

**A camada de dados brutos e o contrato de PII.** ✅ **Resolvida em 18/ago, e não como este parágrafo
previa.** O texto original dizia que `private.is_admin()` deixava de ser acabamento e virava
pré-requisito da camada. O Mateus decidiu o contrário: **não haverá papel de admin no BI**, então o
contrato passa a valer por "quem tem conta no BI" — a segunda saída que a pendência O já listava.

A consequência é mais forte do que parece, e está registrada no CLAUDE.md: **o controle deixa de ser
de acesso e passa a ser de armazenamento.** O que não pode ser visto não pode ser servido. Foi por
isso que o `Explorar` nasceu com allowlist congelada em `marts.explorar_catalogo` nos dois eixos
(tabela e coluna), com padrão seguro dos dois lados e uma guarda que aborta a migration se algum
identificador direto ficar servido — ela é o único controle que sobrou, e não um acabamento.

Conferido na mesma data: são **três** RPCs servindo nome e e-mail a qualquer autenticado, não uma —
`bi_clientes_em_risco`, `bi_masters_top_convidadores` e `bi_ia_experimentaram_e_sumiram`.

---

## 3. Correções ao próprio registro

Três afirmações que o roadmap e o CLAUDE.md sustentam e que o banco desmente. Elas são a razão de
este documento existir com a convenção de verificação no topo.

| Documento afirma | Banco diz **[conferido]** |
| --- | --- |
| pipeline parado desde 08/08 (item U + nota de infraestrutura) | **vivo**: `marts.data_referencia()` = 2026-08-17 = hoje; 1.440 execuções de sync em 24h, 1.440 sucessos, 0 falhas |
| import de CS bloqueado por 2 grants (item R) | grants concedidos |
| `marts.fact_pedido_implementacao` vazia — "agravada" (pendência 3 da auditoria de 08/ago) | 114 linhas |
| `atendimento_tickets` sem qualquer ligação com empresa (item Q) | `organization_id` na origem, 1.979 de 2.639 = 75,0%, 1.308 organizações |
| "~43 funções `bi_*` ainda usam `now()`" (CLAUDE.md) | 43 **já usam** `data_referencia()`; 28 ancoram no relógio — 22 de produto + 6 de CS |

**Consequência prática:** cinco itens da auditoria de 11/ago estavam marcados como travados pelo FDW
e são executáveis hoje — onboarding, NPS × retenção, pedidos de implementação, tokens do Consultor e
limite do Builder.

## 4. O débito técnico não existe na forma descrita

O Mateus mandou tirar da conta "organizações antigas possivelmente sem planos, masters sem org".
Medido na origem **[conferido]**:

| Formulação | Realidade |
| --- | --- |
| "masters sem org" | **zero.** 2.099 masters, integridade `profiles` × `organizations` 1:1 perfeita, nenhum `master_user_id` órfão |
| "organizações antigas" | **não são antigas.** A casca mais nova é de 01/07/2026; as contas reais afetadas vão até 31/07/2026 |
| — | o que existe é **54 organizações sem dono**, 2,5% de 2.153 |

E as 54 se partem em dois grupos de natureza oposta **[conferido]**:

- **38 cascas vazias** — zero membros, zero eventos na história. Exclusão de risco zero: não move
  nenhum número publicado.
- **16 contas reais decapitadas** — perderam o ponteiro do dono, mas têm **50 clientes dentro**.
  Excluí-las apaga gente de verdade.

Mais **111 pessoas com papel `master_user` que nunca tiveram organização** — que provavelmente é o
que o Mateus viu, e é caso de conserto na plataforma, não de exclusão no BI.

> ⚠️ Escrever a migration sobre a formulação literal produziria um filtro que **não filtra uma
> linha**, com todo mundo achando que o débito saiu da conta. É o pior desfecho possível, e é por
> isso que a régua precisa ser reformulada com o Mateus antes de virar SQL.

### Quatro exclusões testadas e REPROVADAS

Ficam registradas para ninguém tentar de novo:

- **por plano nulo** — 148 das 173 têm dono e membros;
- **por nome** — o padrão `%evidencia%` capturou um escritório de advocacia real, com 5 clientes,
  cujo nome contém "PREVIDENCIARIA";
- **por data de criação** — a cauda chega a jul/2026;
- **por organização de um membro só** — é a conta nova legítima.

### A pergunta que bloqueia a fase

**750 clientes estão fora de qualquer organização, 108 ativos nos últimos 30 dias.** Base B2C
legítima ou débito? Excluí-los custa **−5,4% de clientes e −3,4% de ativos** — é o único item do
débito que move número de gente, e muda o denominador de quase toda métrica do BI.

Enquanto não houver resposta, entra como **recorte** (`tipo_conta`), não como exclusão.

---

## 5. O que o pedido NÃO comporta

A parte mais importante do documento. Dizer isto agora vale mais do que descobrir no terceiro mês.

| Pedido | Por que não | O que fica no lugar |
| --- | --- | --- |
| Jornada até o cancelamento **no grão da pessoa** | o cancelamento é da **conta**: 1.106 clientes atrás de 245 organizações, mediana 2 por conta, máximo 57; só 40,8% unipessoais. `marts.fact_cs_cancelamento` não tem `user_id`. Derivar a pessoa por comparação de hash é **capacidade conhecida e recusada** pelo contrato de PII | grão **organização**, declarado na tela. Grão de pessoa exige pedir o campo ao time do Pulse |
| "Qual formação tirar do ar" pelo caminho de quem cancela | com o corte temporal que a própria pergunta exige (aula iniciada **antes** do pedido), **0 de 58 cursos** ficam acima da base de 7,83% + 2 erros padrão. Sem o corte aparece sinal de 2,2× — artefato de contar aluno que abriu o curso **depois** de cancelar. E testar 58 cursos é escolher o vencedor de 58 sorteios | decidir por **progressão de grade**, normalizada pelo tamanho da grade. Ressalva: os dois piores (Typebot e HotSeats) **já estão fora do ar** |
| "Telas mais assistidas" antes do cancelamento | só 98 dos 245 casos têm navegação anterior; quebrado por desfecho, o braço RETIDO fica com **12** contra o piso de 30. É arquivo que não existe | a mesma comparação por **solução/formação consumida** (PERDIDO 86 × RETIDO 35), que passa nos dois braços |
| **"Tempo do usuário"** | **não existe fonte em nenhum dos três bancos.** `learning_progress.last_position_seconds` = 0 em todas as 151.164 linhas; `onboarding_step_tracking` e `onboarding_abandonment_points` com 0 linhas; `analytics` grava sem duração e sem sessão | aposentar o KPI enviesado; usar as durações medidas de verdade; pedir instrumentação (heartbeat + `session_id`) à plataforma |
| "Literalmente todos os insights" | motor de catálogo só sabe o que alguém previu: 35 regras em 9 telas, **CS com zero**. E ele está **saturado** — 35 de 35 dispararam, 0 suprimidas, o estado "nada fora do padrão" nunca ocorreu | recalibrar limiar regra a regra + a camada de dado bruto, que é o que responde honestamente a "tudo" |
| Plano de ação com **efeito medido** | **não existe experimentação em nenhum dos três bancos** — nenhuma tabela de variante, bucket, rollout ou holdout | a ação nomeia a alavanca e declara que o efeito não será atribuível; reincidência é o substituto honesto |
| Análise de caminho com horizonte longo | os dois eixos não se cruzam: navegação tem 46 dias de arquivo; `fact_evento` tem 461 dias mas só virou multi-módulo em 13/04/2026. A janela em que caminho rico e desfecho coexistem é de ~4 meses e **nunca cresce para trás** | trocar "sequência" por **composição em janela fixa**: o que a pessoa fez nos primeiros 30 dias contra o desfecho em janela fechada |

---

## 6. Sequência de fases

| # | Fase | Entrega | Trava |
| --- | --- | --- | --- |
| 1 | A régua da base | `e_org_valida` isolando as 38 cascas; `tipo_conta` separando os 750 sem excluir; relatório de integridade das 16 contas decapitadas | **decisão do Mateus** (os 750) |
| 2 | Parar de publicar número quebrado | guarda de instrumentação ✅, aposentadoria do KPI de duração ✅, reconciliação do espelho de CS ✅, RPCs órfãs ✅, lote das 22 RPCs com `now()` ✅ (18/ago, md5 conferido antes e depois nas 20) — **falta só o corte de sessão inflada** | **decisão do Mateus: o limiar do corte** |
| 3 | O desfecho vem do CS | `organization_id` em `fact_cs_atendimento`; o card "o que a conta consumiu antes do desfecho"; primeiras regras de CS no motor | fases 1 e 2 |
| 4 | Coorte de entrada → desfecho comportamental | 5.746 clientes com 90 dias de observação, janela fechada, estratificado por intensidade | fase 1 |
| 5 | Performando contra o quê | limiar **absoluto** no lugar do quartil interno; normalização por tamanho de grade; tokens e limite de plano | **decisão do Mateus** (a meta) |
| 6 | Dados brutos navegáveis | ✅ **entregue em 18/ago**: aba `Dados` por módulo (sem consulta nova) + `/explorar` sobre 37 tabelas e 1,78 M de linhas, por allowlist congelada em `marts.explorar_catalogo`. **Nominal NÃO fica atrás de `is_admin()`** — não haverá papel de admin (decisão de 18/08), e o controle passou a ser de armazenamento. Falta repetir a aba `Dados` nos outros 9 módulos e a exportação | ✅ |
| 7 | O motor atravessa telas e ganha memória | RPC transversal CS × plataforma; histórico append por cron; recalibração de severidade | fases 3–5 |
| 8 | Plano de ação como objeto | ✅ **modo REPORTA no ar em 18/ago** (`/plano`, `bi_plano_de_acao`): lista transversal ordenada por score, com âncora para o card que prova e a saturação do motor declarada. O modo GERIR (dono, prazo, status, reincidência) segue aberto e é aditivo — nada do que subiu precisa ser desfeito | **decisão do Mateus** (reportar × gerir) |

### Buracos conhecidos neste plano

Achados pela crítica de completude, registrados para não serem redescobertos:

- **Convites não tem fase nenhuma** — e é o mecanismo central do modelo B2B. A taxa de aceite de
  66,9% **mistura "não aceito" com "nunca enviado"**: `marts.fact_convite` tem 9 colunas e nenhuma
  de envio, enquanto `invites.last_sent_at` está vivo com 24.253 de 32.726 preenchidos.
- **Organizações entra só como régua de exclusão** (fase 1). Ocupação de assento e o par
  comprador × convidado ficam de fora da fase 5.
- **A fase 4 se contradiz**: promete n = 5.746 e declara "nada antes de 13/04/2026", mas 3.752
  (65,3%) da coorte são anteriores a essa data. Honrando a ressalva sobram 1.994.
- **A fase 5 afirma que os tokens do Consultor já estão espelhados** contra limite de plano. O
  limite vive na origem (`consultor_ia_token_usage.daily_limit`, diário e por linha) e **não está no
  mart**. O do Builder também não.
- **`etl.sync_fact_navegacao` reconstrói só os últimos 45 dias**; `sync_fact_pageview` não tem
  delete. Qualquer mudança de régua de sessão deixaria o resto da tabela com a régua velha, e
  ranking com janela > 45 dias misturaria duas definições.

---

## 7. Decisões pendentes do Mateus

Ordenadas por quanto travam.

1. **Os 750 clientes fora de organização** (108 ativos) — base B2C ou débito? Custa −5,4% de
   clientes e −3,4% de ativos. **Bloqueia a fase 1.**
2. **Confirmar a formulação do débito** — "masters sem org" devolve conjunto vazio; o que existe são
   54 organizações sem dono e 111 pessoas com papel `master_user` sem organização.
3. **Qual é o desfecho primário do produto**: "parou de usar" (5.746 pessoas, grão pessoa,
   disponível hoje) ou "pediu cancelamento" (245 organizações, grão empresa)?
4. **Nas 59,2% de contas canceladas com 2+ clientes, o master representa o decisor?** É hipótese
   defensável, mas é hipótese.
5. **Qual é a meta** de uma solução e de uma formação performando? **Bloqueia a fase 5.**
6. **O BI reporta ou gere plano de ação?** Todo o desenho da fase 8 depende disso.
7. **Régua de severidade** (pendência E): histerese, faixa de incerteza, ou aposentar o gradiente?
   8 das 35 regras estão a menos de 0,05 do corte.
8. **A camada de análise passa a ser redigida por modelo?** Se sim, com o calculador produzindo o
   número e o modelo só redigindo.
9. **Receita** (pendência A): reconectar, apontar para o `via_hub`, ou congelar de vez.
10. ~~**Lista nominal atrás de `is_admin()`** (pendência O) — bloqueia a fase 6.~~ **RESPONDIDA em 18/08: não haverá papel de admin.** O contrato de PII passa a valer por "quem tem conta no BI", e o controle vira de armazenamento — o que não pode ser visto não é servido.
11. ~~**Até onde vai "todos os dados brutos"** e quem vê o quê.~~ **RESPONDIDA em 18/08 (o Mateus pediu para seguir a análise):** todos os marts com linha, menos os identificadores diretos — `nome`, `email`, `organizacao`, a régua vivendo em `marts.identificadores_diretos()`. Chave e hash entram, porque distinguem sem identificar. Quem vê: todo mundo com conta no BI.

### Pedidos a terceiros, que têm lead time

- **À plataforma:** por que `solution_started` morreu em 22/06/2026; por que `fact_progresso_aula`
  grava só conclusão (pct = 100 em 98,6% das linhas, o que esvazia qualquer métrica de "% de
  conclusão de aula"); instrumentação de tempo (heartbeat + `session_id`).
- **Ao Pulse:** religar a classificação de intenção do chat (existia com 7 categorias, captou 328
  `cancellation_request`, morreu em 19/03/2026, dez dias depois de o chat atual nascer); criar campo
  categórico de motivo de cancelamento.
- **Ao time da plataforma:** remover o cron `cleanup-analytics-views` (jobid 10) em vez de deixá-lo
  desativado com o schedule dominical intacto — uma linha o religa, e o BI é a única cópia dos
  pageviews de 03 a 09/07/2026.

---

## 8. Registro de decisão sobre gravação de sessão / heatmap

Levantado em 17/ago a pedido do Mateus e **recusado por ora**, com motivo.

Gravação de sessão e mapa de calor resolvem **usabilidade de tela** ("por que ninguém clica aqui").
A pergunta de caminho → cancelamento é de **conteúdo e coorte**. São projetos diferentes.

Três motivos para não instalar agora:

1. **Começa com histórico zero**, enquanto `fact_progresso_aula` tem 15 meses.
2. **O gargalo é o desfecho e o modelo, não o rastreio** — nenhuma gravação conserta grão de
   organização nem 245 casos de amostra.
3. **Colide com o contrato de PII.** A tela renderiza conversa do Consultor (59.956 mensagens de
   2.705 usuários), diagnóstico de negócio (545 planejamentos), faixa de faturamento (~3 mil perfis)
   e o diretório de networking (4.820 perfis, ~14,3 mil telefones — a gravação de A capturaria dado
   de B). O padrão de fábrica de Clarity, PostHog, LogRocket e FullStory captura texto renderizado.

**Clarity está descartada** por três motivos independentes: a Microsoft se declara controladora
independente e não assina contrato de operador; os dados vão para os EUA; e apagar as gravações de
um titular exige apagar o projeto inteiro, o que torna o art. 18 inexequível. Smartlook foi
descontinuada (End of Sale em 31/05/2026).

Se a frente de usabilidade for aprovada depois, o candidato é **PostHog Cloud UE** (Frankfurt,
~US$ 150/mês no nosso volume), carregado só nas rotas sem conteúdo de cliente, com kill switch no
roteador — **não** máscara por seletor CSS, que é blocklist e falha em silêncio quando o CSS muda.
São 11 obrigações de LGPD que bloqueiam o lançamento, a maioria com dono no jurídico/DPO.

A pergunta para o jurídico não é "qual ferramenta" — é *"podemos gravar a tela de um cliente logado
que descreve o próprio negócio no Consultor?"*.

---

## 9. Ganhos disponíveis sem depender de decisão nenhuma

- **Fase 2 inteira** (em execução) — corrige número que está na tela agora.
- **`public.client_error_logs`**: 8.939 erros desde 22/06, sendo 7.146 `uncaught` atingindo **1.790
  usuários distintos**, 91% com dono identificado — e o espelho `marts.fact_erro_cliente` **descarta
  o `user_id`**. Uma coluna e uma tela entregam a evidência de usabilidade mais barata disponível.
- **Clique instrumentado na própria plataforma custa zero DDL**: `public.analytics` já aceita
  `event_type` livre com `event_data` jsonb, a policy já autoriza o insert do próprio usuário, o
  índice existe, e a purga filtra só `'view'` — um `event_type='click'` nasce imune a ela.
  First-party, imune a bloqueador de anúncio, sob a nossa régua de PII.
