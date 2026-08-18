import {
  ChartColumnIcon,
  Building2Icon,
  ClipboardListIcon,
  CompassIcon,
  FileTextIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapIcon,
  PaletteIcon,
  PuzzleIcon,
  ReceiptIcon,
  TelescopeIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AbaDoModulo = {
  /** aparece na URL como ?aba=<valor> */
  valor: string
  titulo: string
  icone: LucideIcon
}

/**
 * Blocos do rail lateral.
 *
 * O rail mostra só ícone, então o agrupamento É a única pista de arquitetura que
 * o leitor tem antes de passar o mouse. Um espaço entre blocos diz "estes quatro
 * respondem o mesmo tipo de pergunta" sem gastar uma palavra.
 *
 * A ordem é a da pergunta que o negócio faz, não a da entrega: quem é o cliente
 * → o que ele usa → quanto isso vale.
 */
export const GRUPOS_DE_NAV = ['panorama', 'quem', 'uso', 'negocio'] as const

export type GrupoDeNav = (typeof GRUPOS_DE_NAV)[number]

export type NavItem = {
  /** nome completo — cabeçalho da página e navegação mobile */
  title: string
  /** nome curto para a barra do topo, onde 9 itens disputam a largura */
  shortTitle: string
  to: string
  icon: LucideIcon
  /** bloco do rail; a ausência tira o item do rail (ferramentas) */
  grupo?: GrupoDeNav
  /**
   * Frase de uma linha sob o título, no topo do módulo.
   *
   * É a régua da tela inteira — o que conta, a janela, a exclusão. Vive aqui e
   * não na página porque o topo é quem desenha, e duplicar era garantir que um
   * dia divergem.
   */
  regua?: string
  /** a tela oferece seletor de período */
  temPeriodo?: boolean
  /** a tela oferece o recorte por persona e plano */
  temRecorte?: boolean
  /** rota é ativa por prefixo (útil para páginas de detalhe) */
  matchPrefix?: boolean
  /**
   * As três abas do módulo — **iguais em todas as telas** (decisão do Mateus,
   * 18/ago/2026).
   *
   * `Gráficos` (o dado) · `Análise` (a leitura) · `Plano` (a sugestão). É a
   * arquitetura de três camadas virando gramática de tela: o leitor aprende a
   * ordem uma vez e ela vale em qualquer módulo.
   *
   * ⚠️ **Isto substituiu as abas por pergunta** (`retencao`, `funil`,
   * `catalogo`, `implementacao`…), que variavam de tela para tela. O
   * agrupamento por pergunta não se perdeu: passou para a `SecaoDeAnalise`,
   * dentro da aba `Gráficos`, que é onde ele já morava visualmente.
   *
   * Declaradas AQUI e não na página porque dois consumidores precisam da mesma
   * lista: a página, que renderiza o painel, e a barra do topo, que oferece o
   * atalho. Declarar nos dois lugares seria garantir que um dia divergem.
   *
   * ⚠️ **`graficos` é o alvo de TODA âncora do motor de achados.**
   * `insights.regra.ancora_aba` vale `'graficos'` nas 35 regras, e é por ele
   * que o link "ver o gráfico que sustenta" navega. Renomear esse valor aqui
   * quebraria os 35 links em silêncio — o link trocaria de aba e não rolaria
   * para nada. `contrato-de-shell.test.ts` reprova a ausência da aba.
   *
   * A primeira aba é a padrão (`useAbaAtiva` cai em `abas[0]`), então a ordem
   * aqui é a ordem da leitura: dado, depois significado, depois ação.
   */
  abas?: AbaDoModulo[]
}

/** Ponto único para registrar novas seções do produto. */
export const navItems: NavItem[] = [
  {
    title: 'Plano de ação',
    shortTitle: 'Plano',
    to: '/plano',
    grupo: 'panorama',
    regua:
      'O que atacar primeiro, em todos os módulos · cada item é um achado calculado na tela de origem, com a régua e o número que o card de lá mostra · sem seletor de período: os módulos têm janelas diferentes e cada frase carrega a própria',
    icon: ClipboardListIcon,
  },
  {
    title: 'Explorar',
    shortTitle: 'Explorar',
    to: '/explorar',
    grupo: 'panorama',
    regua:
      'O dado bruto dos marts, por allowlist congelada em migration · chave e hash são servidos de propósito, identificador direto não sai daqui e a retenção aparece com o nome do campo',
    icon: TelescopeIcon,
  },
  {
    title: 'Visão geral',
    shortTitle: 'Visão geral',
    to: '/',
    grupo: 'panorama',
    regua:
      'Uso da plataforma pelos clientes · cliente ativo = 1+ ação de produto no dia',
    temPeriodo: true,
    temRecorte: true,
    icon: LayoutDashboardIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Clientes',
    shortTitle: 'Clientes',
    to: '/clientes',
    grupo: 'quem',
    regua:
      'Retenção, hábito e risco · cliente ativo = 1+ ação de produto no dia · eventos desde mai/2025',
    temPeriodo: true,
    temRecorte: true,
    icon: UsersIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Entrada',
    shortTitle: 'Entrada',
    to: '/entrada',
    grupo: 'quem',
    // "safra fechada de 30 dias" esteve aqui e contradizia a tela: o funil chama
    // a RPC com o período escolhido no topo, então quem seleciona 90 dias lia uma
    // régua afirmando 30. A régua acompanha o controle, ou deixa de ser régua.
    regua:
      'Convite, cadastro, onboarding e a primeira ação · funil por safra de convites criados no período',
    temPeriodo: true,
    icon: UserPlusIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Formações',
    shortTitle: 'Formações',
    to: '/formacoes',
    grupo: 'uso',
    regua:
      'Uso, jornada do aluno, duração de aula e qualidade percebida',
    temPeriodo: true,
    icon: GraduationCapIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Soluções',
    shortTitle: 'Soluções',
    to: '/solucoes',
    grupo: 'uso',
    regua:
      'Catálogo, implementação e curadoria · conclusão histórica desde o início',
    temPeriodo: true,
    icon: PuzzleIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Consultor & Builder',
    shortTitle: 'IA',
    to: '/ia',
    grupo: 'uso',
    regua:
      'Adoção, recorrência e confiabilidade do Consultor e do Builder · rastreado desde mai/2026',
    temPeriodo: true,
    icon: CompassIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Organizações',
    shortTitle: 'Orgs',
    to: '/organizacoes',
    grupo: 'quem',
    regua:
      'Saúde dos times e valor contratado não consumido · time ativo = ação nos 30 dias até o último dia com dado',
    icon: Building2Icon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Jornada & Telas',
    shortTitle: 'Jornada',
    to: '/jornada',
    grupo: 'uso',
    // O agrupamento de rota é armadilha de leitura, não detalhe técnico: sem essa
    // cláusula, o leitor não tem como saber que /formacao/abc e /formacao/def são
    // a MESMA linha do raio-x. Ela morava no subtítulo da página e veio junto.
    regua:
      'Raio-x de tela e fluxo de sessão · sessão = navegação com intervalo menor que 30 min · rotas com identificador são agrupadas em padrão',
    temPeriodo: true,
    icon: MapIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Receita',
    shortTitle: 'Receita',
    to: '/receita',
    grupo: 'negocio',
    // A deduplicação é a REGRA DE CONTAGEM, não trivia: sem ela o leitor não sabe
    // que a mesma fatura reprocessada conta uma vez. Morava no subtítulo da página.
    regua:
      'Receita reconhecida dos webhooks de pagamento (Hubla), com faturas deduplicadas · a série termina onde o rastreamento parou',
    icon: ReceiptIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
  {
    title: 'Sucesso do cliente',
    shortTitle: 'CS',
    to: '/cs',
    grupo: 'negocio',
    regua:
      'Atendimento, comunicação e retenção · origem: plataforma Pulse',
    temPeriodo: true,
    icon: HeadphonesIcon,
    abas: [
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'plano', titulo: 'Plano', icone: ClipboardListIcon },
    ],
  },
]

/**
 * Fora da barra principal: é ferramenta interna, não seção de produto, e
 * ocupava um dos nove lugares que disputam a largura do topo. Vive no menu de
 * ações, junto com tema e sair.
 */
export const navFerramentas: NavItem[] = [
  { title: 'Regras do resumo', shortTitle: 'Regras', to: '/regras', icon: ListChecksIcon },
  { title: 'Design system', shortTitle: 'Design', to: '/design', icon: PaletteIcon },
]

/** Abas de uma rota, para a página renderizar e a barra oferecer o atalho. */
export function abasDaRota(rota: string): AbaDoModulo[] {
  return navItems.find((item) => item.to === rota)?.abas ?? []
}

/**
 * Módulo a que pertence uma tela do motor de achados.
 *
 * O motor identifica a tela por slug (`visao-geral`, `clientes`), e a rota é o
 * slug com barra na frente — menos a Visão Geral, que é a raiz. Vive aqui, e
 * não em cada página, porque agora tem dois leitores (`/regras` e o plano de
 * ação) e a conversão errada não quebra nada: só mostra o slug cru no lugar do
 * nome, que foi exatamente o defeito de sete telas em 17/ago.
 */
export function moduloDaTela(tela: string): NavItem | undefined {
  const rota = tela === 'visao-geral' ? '/' : `/${tela}`
  return navItems.find((item) => item.to === rota)
}

/**
 * Módulo da rota atual — quem a barra do topo está descrevendo.
 *
 * As ferramentas entram na busca porque também têm barra (com marca e ações),
 * só não têm abas. Sem elas, `/design` e `/regras` apareceriam como se
 * estivessem fora do app.
 */
export function moduloDaRota(pathname: string): NavItem | undefined {
  return (
    navItems.find((item) =>
      item.matchPrefix ? pathname.startsWith(item.to) : pathname === item.to,
    ) ?? navFerramentas.find((item) => pathname.startsWith(item.to))
  )
}
