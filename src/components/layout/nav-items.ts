import {
  BanknoteIcon,
  BookOpenIcon,
  BotIcon,
  ChartColumnIcon,
  Building2Icon,
  CheckCheckIcon,
  CompassIcon,
  DoorOpenIcon,
  FileTextIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  HeartCrackIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LineChartIcon,
  ListChecksIcon,
  MapIcon,
  MessageSquareIcon,
  MonitorIcon,
  PaletteIcon,
  PuzzleIcon,
  ReceiptIcon,
  RouteIcon,
  ScissorsIcon,
  SendIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AbaDoModulo = {
  /** aparece na URL como ?aba=<valor> */
  valor: string
  titulo: string
  icone: LucideIcon
}

export type NavItem = {
  /** nome completo — cabeçalho da página e navegação mobile */
  title: string
  /** nome curto para a barra do topo, onde 9 itens disputam a largura */
  shortTitle: string
  to: string
  icon: LucideIcon
  /** rota é ativa por prefixo (útil para páginas de detalhe) */
  matchPrefix?: boolean
  /**
   * Abas de contexto do módulo.
   *
   * Declaradas AQUI e não na página porque dois consumidores precisam da mesma
   * lista: a página, que renderiza as abas, e a barra do topo, que oferece o
   * atalho para cada uma. Declarar nos dois lugares seria garantir que um dia
   * divergem.
   *
   * Toda tela abre em `analise` — o documento escrito. As abas seguintes são os
   * gráficos que o sustentam, fatiados por PERGUNTA quando o módulo tem mais de
   * uma (retenção, risco, o que funciona) e num painel só quando não tem. Sem
   * essa separação a página vira um documento espremido entre gráficos, que foi
   * como a Visão Geral nasceu e o motivo de ter sido refeita.
   *
   * O `valor` de cada aba é o mesmo texto que as regras gravam em `ancora_aba`:
   * é por ele que o link "Ver o gráfico que sustenta" atravessa da análise para
   * o gráfico. Renomear uma aba aqui sem renomear no catálogo quebra o link em
   * silêncio — ele troca de aba e não rola para lugar nenhum.
   */
  abas?: AbaDoModulo[]
}

/** Ponto único para registrar novas seções do produto. */
export const navItems: NavItem[] = [
  {
    title: 'Visão geral',
    shortTitle: 'Visão geral',
    to: '/',
    icon: LayoutDashboardIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
    ],
  },
  {
    title: 'Clientes',
    shortTitle: 'Clientes',
    to: '/clientes',
    icon: UsersIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'retencao', titulo: 'Retenção & hábito', icone: LineChartIcon },
      { valor: 'risco', titulo: 'Risco & churn', icone: TriangleAlertIcon },
      { valor: 'funciona', titulo: 'O que funciona', icone: TargetIcon },
    ],
  },
  {
    title: 'Entrada',
    shortTitle: 'Entrada',
    to: '/entrada',
    icon: UserPlusIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'funil', titulo: 'Funil', icone: DoorOpenIcon },
      { valor: 'onboarding', titulo: 'Onboarding & convites', icone: ListChecksIcon },
      { valor: 'porta', titulo: 'Problemas na porta', icone: TriangleAlertIcon },
    ],
  },
  {
    title: 'Formações',
    shortTitle: 'Formações',
    to: '/formacoes',
    icon: GraduationCapIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'uso', titulo: 'Uso & assuntos', icone: BookOpenIcon },
      { valor: 'conclusao', titulo: 'Conclusão', icone: CheckCheckIcon },
      { valor: 'qualidade', titulo: 'Jornada & NPS', icone: StarIcon },
    ],
  },
  {
    title: 'Soluções',
    shortTitle: 'Soluções',
    to: '/solucoes',
    icon: PuzzleIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'catalogo', titulo: 'Catálogo', icone: LayoutGridIcon },
      { valor: 'implementacao', titulo: 'Implementação', icone: WrenchIcon },
      { valor: 'curadoria', titulo: 'Curadoria', icone: ScissorsIcon },
    ],
  },
  {
    title: 'Consultor & Builder',
    shortTitle: 'IA',
    to: '/ia',
    icon: CompassIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'adocao', titulo: 'Adoção', icone: UsersIcon },
      { valor: 'uso', titulo: 'Uso', icone: MessageSquareIcon },
      { valor: 'impacto', titulo: 'Impacto na retenção', icone: TrendingUpIcon },
    ],
  },
  {
    title: 'Organizações',
    shortTitle: 'Orgs',
    to: '/organizacoes',
    icon: Building2Icon,
    // As duas abas separam formato, não assunto: o panorama continua inteiro num
    // painel só. Fatiar o panorama por pergunta é que deixaria de ser panorama.
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'graficos', titulo: 'Gráficos', icone: ChartColumnIcon },
    ],
  },
  {
    title: 'Jornada & Telas',
    shortTitle: 'Jornada',
    to: '/jornada',
    icon: MapIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'telas', titulo: 'Raio-x de tela', icone: MonitorIcon },
      { valor: 'fluxos', titulo: 'Fluxos & sessão', icone: RouteIcon },
    ],
  },
  {
    title: 'Receita',
    shortTitle: 'Receita',
    to: '/receita',
    icon: ReceiptIcon,
    abas: [
      { valor: 'analise', titulo: 'Análise', icone: FileTextIcon },
      { valor: 'receita', titulo: 'Receita', icone: BanknoteIcon },
      { valor: 'safra', titulo: 'Safra & uso', icone: LayersIcon },
    ],
  },
  {
    title: 'Sucesso do cliente',
    shortTitle: 'CS',
    to: '/cs',
    icon: HeadphonesIcon,
    abas: [
      { valor: 'atendimento', titulo: 'Atendimento', icone: BotIcon },
      { valor: 'comunicacao', titulo: 'Comunicação', icone: SendIcon },
      { valor: 'retencao', titulo: 'Cancelamento & reversão', icone: HeartCrackIcon },
      { valor: 'funis', titulo: 'Kickoff & funis', icone: ListChecksIcon },
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
