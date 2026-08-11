export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bi_aha_moment: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          acao: string
          fizeram: number
          lift: number
          nao_fizeram: number
          ret_fizeram: number
          ret_nao_fizeram: number
        }[]
      }
      bi_amplitude_modulos: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          clientes: number
          modulos: number
        }[]
      }
      bi_assuntos: {
        Args: { p_dias?: number }
        Returns: {
          alunos: number
          aulas_concluidas: number
          categoria: string
        }[]
      }
      bi_atividade_diaria: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          ativos: number
          data: string
        }[]
      }
      bi_builder_steps: {
        Args: { p_dias?: number }
        Returns: {
          geracoes: number
          pct_erro: number
          segundos_medio: number
          step: string
        }[]
      }
      bi_churn_modulos: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          gap_pp: number
          medido_desde: string
          modulo: string
          pct_ativos_nunca_usou: number
          pct_churned_nunca_usou: number
        }[]
      }
      bi_churn_resumo: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          ativos: number
          churned: number
          pct_churn: number
          vida_media_dias: number
        }[]
      }
      bi_churn_ultimo_modulo: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          clientes: number
          modulo: string
          pct: number
        }[]
      }
      bi_clientes_em_risco: {
        Args: { p_limite?: number; p_papel?: string; p_plano?: string }
        Returns: {
          dias_ate_vencer: number
          dias_inativo: number
          email: string
          motivo: string
          nome: string
          organizacao: string
          plano: string
          ultima_atividade: string
        }[]
      }
      bi_consultor_modos: {
        Args: never
        Returns: {
          modo: string
          threads: number
          usuarios: number
        }[]
      }
      bi_consultor_recorrencia: {
        Args: { p_dias?: number }
        Returns: {
          faixa: string
          ordem: number
          usuarios: number
        }[]
      }
      bi_cs_atendimento_cobertura: {
        Args: { p_dias?: number }
        Returns: {
          atendimentos: number
          atribuicao: string
          pct: number
        }[]
      }
      bi_cs_atendimento_ia_humano: {
        Args: { p_dias?: number }
        Returns: {
          com_humano: number
          desfecho: string
          so_ia: number
          total: number
        }[]
      }
      bi_cs_atendimento_mensal: {
        Args: never
        Returns: {
          atendimentos: number
          contatos: number
          conversas: number
          mes: string
        }[]
      }
      bi_cs_atendimento_por_atendente: {
        Args: { p_dias?: number }
        Returns: {
          atendente: string
          atendimentos: number
          contatos: number
        }[]
      }
      bi_cs_atendimento_por_canal: {
        Args: { p_dias?: number }
        Returns: {
          atendimentos: number
          canal: string
        }[]
      }
      bi_cs_cancelamento_desfecho: {
        Args: never
        Returns: {
          solicitacoes: number
          tipo_acordo: string
        }[]
      }
      bi_cs_cancelamento_mensal: {
        Args: never
        Returns: {
          mes: string
          solicitacoes: number
        }[]
      }
      bi_cs_cancelamento_origem: {
        Args: never
        Returns: {
          origem: string
          solicitacoes: number
        }[]
      }
      bi_cs_disparos_mensal: {
        Args: never
        Returns: {
          disparos: number
          falhas: number
          mensagens: number
          mes: string
          pessoas: number
        }[]
      }
      bi_cs_disparos_por_canal: {
        Args: { p_dias?: number }
        Returns: {
          canal: string
          enviados: number
          falhas: number
          ignorados: number
          pct_erro: number
        }[]
      }
      bi_cs_frescor: {
        Args: never
        Returns: {
          carregado_em: string
          linhas: number
          tabela: string
        }[]
      }
      bi_cs_funil: {
        Args: { p_quadro: string }
        Returns: {
          cards: number
          etapa: string
          etapa_ordem: number
        }[]
      }
      bi_cs_kpis: {
        Args: { p_dias?: number }
        Returns: {
          atendimentos: number
          contatos: number
          em_tentativa_reversao: number
          pessoas_impactadas: number
          revertidos: number
          solicitacoes_cancelamento: number
        }[]
      }
      bi_cs_retencao: {
        Args: never
        Returns: {
          em_tentativa_reversao: number
          empresas: number
          status: string
        }[]
      }
      bi_dias_ativos_distribuicao: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          clientes: number
          faixa: string
          ordem: number
        }[]
      }
      bi_dropoff_posicao: {
        Args: never
        Returns: {
          decil: number
          taxa_media: number
        }[]
      }
      bi_duracao_ideal: {
        Args: never
        Returns: {
          aulas: number
          faixa: string
          ordem: number
          taxa_media: number
        }[]
      }
      bi_engajamento_clientes: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          base_habito: number
          dau_medio: number
          dias_ativos_medio: number
          mau: number
          pct_habito_semanal: number
          pct_mais_de_um_dia: number
          pct_multimodulo: number
          stickiness: number
        }[]
      }
      bi_entrada_kpis: {
        Args: { p_dias?: number }
        Returns: {
          conversao: number
          convites: number
          erros_login: number
          onboarding_pct: number
        }[]
      }
      bi_erros_login: {
        Args: { p_dias?: number }
        Returns: {
          categoria: string
          ocorrencias: number
        }[]
      }
      bi_erros_por_tela: {
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          ocorrencias: number
          tela: string
        }[]
      }
      bi_eventos_por_tipo: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          eventos: number
          tipo: string
        }[]
      }
      bi_fluxo_da_tela: {
        Args: { p_dias?: number; p_tela: string }
        Returns: {
          destino: string
          pct: number
          transicoes: number
        }[]
      }
      bi_formacoes_kpis: {
        Args: { p_dias?: number }
        Returns: {
          alunos_ativos: number
          aulas_concluidas: number
          certificados: number
          nps_medio: number
        }[]
      }
      bi_formacoes_uso: {
        Args: { p_dias?: number }
        Returns: {
          alunos: number
          alunos_historico: number
          aulas_concluidas: number
          categoria: string
          certificados_historico: number
          conclusao_historica: number
          curso: string
        }[]
      }
      bi_funil_entrada: {
        Args: { p_dias?: number }
        Returns: {
          etapa: string
          ordem: number
          pct_do_inicio: number
          quantidade: number
        }[]
      }
      bi_heatmap_navegacao: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          dia_semana: number
          hora: number
          pageviews: number
        }[]
      }
      bi_ia_adocao: {
        Args: { p_dias?: number }
        Returns: {
          ferramenta: string
          pct_dos_ativos: number
          usuarios: number
        }[]
      }
      bi_ia_impacto_retencao: {
        Args: never
        Returns: {
          clientes: number
          grupo: string
          pct_retencao: number
          retidos: number
        }[]
      }
      bi_ia_kpis: {
        Args: { p_dias?: number }
        Returns: {
          mensagens_consultor: number
          solucoes_builder: number
          usuarios_builder: number
          usuarios_consultor: number
        }[]
      }
      bi_jornada_cursos: {
        Args: { p_min_certificados?: number }
        Returns: {
          certificados: number
          curso: string
          mediana_dias: number
        }[]
      }
      bi_jornada_kpis: {
        Args: { p_dias?: number }
        Returns: {
          minutos_medianos: number
          pct_uma_tela: number
          sessoes: number
          telas_por_sessao: number
        }[]
      }
      bi_ltv_cohort: {
        Args: never
        Returns: {
          clientes: number
          cohort_mes: string
          compradores: number
          receita_brl: number
          receita_por_cliente: number
        }[]
      }
      bi_masters_convites_resumo: {
        Args: never
        Returns: {
          conversao_convites: number
          masters_convidaram: number
          masters_total: number
          pct_convidam: number
        }[]
      }
      bi_masters_top_convidadores: {
        Args: { p_limite?: number }
        Returns: {
          conversao: number
          convites: number
          email: string
          nome: string
          organizacao: string
          usados: number
        }[]
      }
      bi_nps_cursos: {
        Args: { p_min_respostas?: number }
        Returns: {
          curso: string
          media: number
          pct_detratores: number
          pct_promotores: number
          respostas: number
        }[]
      }
      bi_onboarding_abandono: {
        Args: never
        Returns: {
          clientes: number
          step_atual: number
        }[]
      }
      bi_orgs_efeito_master: {
        Args: never
        Returns: {
          grupo: string
          membros: number
          orgs: number
          pct_time_ativo: number
        }[]
      }
      bi_orgs_kpis: {
        Args: never
        Returns: {
          membros_total: number
          orgs_ativas: number
          orgs_master_ativo: number
          pct_time_ativo_medio: number
        }[]
      }
      bi_orgs_ocupacao: {
        Args: never
        Returns: {
          faixa: string
          ordem: number
          orgs: number
        }[]
      }
      bi_orgs_risco: {
        Args: { p_limite?: number }
        Returns: {
          assentos_ociosos: number
          ativos_30d: number
          master_ativo: boolean
          membros: number
          organizacao: string
          pct_time_ativo: number
          plano: string
        }[]
      }
      bi_pontos_saida: {
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          pct_da_tela: number
          saidas: number
          tela: string
        }[]
      }
      bi_portas_entrada: {
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          pct: number
          sessoes: number
          tela: string
        }[]
      }
      bi_power_users: {
        Args: {
          p_dias?: number
          p_limite?: number
          p_papel?: string
          p_plano?: string
        }
        Returns: {
          dias_ativos: number
          email: string
          eventos: number
          modulos: number
          nome: string
          organizacao: string
          plano: string
        }[]
      }
      bi_profundidade_sessao: {
        Args: { p_dias?: number }
        Returns: {
          faixa: string
          ordem: number
          sessoes: number
        }[]
      }
      bi_raio_x_telas: {
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          pageviews: number
          pct_entrada: number
          pct_saida: number
          posicao_media: number
          tela: string
          usuarios: number
        }[]
      }
      bi_receita_kpis: {
        Args: never
        Returns: {
          compradores: number
          dados_ate: string
          faturas: number
          receita_brl: number
          reembolsado_brl: number
          ticket_mediano: number
        }[]
      }
      bi_receita_mensal: {
        Args: never
        Returns: {
          compradores: number
          faturas: number
          mes: string
          receita_brl: number
        }[]
      }
      bi_receita_saude_cobranca: {
        Args: never
        Returns: {
          evento: string
          faturas: number
          pct_do_pago: number
          valor_brl: number
        }[]
      }
      bi_retencao_cohort: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          clientes: number
          cohort_mes: string
          ret_180d: number
          ret_30d: number
          ret_7d: number
          ret_90d: number
        }[]
      }
      bi_retencao_por_amplitude: {
        Args: { p_papel?: string; p_plano?: string }
        Returns: {
          clientes: number
          modulos: number
          pct_retidos: number
        }[]
      }
      bi_retencao_por_papel: {
        Args: { p_plano?: string }
        Returns: {
          clientes: number
          papel: string
          pct_retidos: number
        }[]
      }
      bi_saude_pipeline: {
        Args: never
        Returns: {
          esta_defasado: boolean
          falhas_recentes: number
          horas_desde_sync: number
          tabelas_ok: number
          ultima_sync: string
          ultimo_erro: string
        }[]
      }
      bi_solucoes_candidatas_remocao: {
        Args: never
        Returns: {
          categoria: string
          concluidas: number
          favoritos: number
          iniciadas: number
          motivo: string
          nota: number
          pageviews: number
          solucao: string
        }[]
      }
      bi_solucoes_conclusao_por_aba: {
        Args: never
        Returns: {
          aba: string
          ordem: number
          pct_da_maior_aba: number
          usuarios: number
        }[]
      }
      bi_solucoes_conversao_tela: {
        Args: { p_dias?: number }
        Returns: {
          desde: string
          etapa: string
          ordem: number
          pct: number
          usuarios: number
        }[]
      }
      bi_solucoes_kpis: {
        Args: { p_dias?: number }
        Returns: {
          concluidas_periodo: number
          iniciadas_periodo: number
          publicadas: number
          taxa_conclusao_historica: number
        }[]
      }
      bi_solucoes_por_categoria: {
        Args: never
        Returns: {
          categoria: string
          concluidas: number
          iniciadas: number
          solucoes: number
          taxa_conclusao: number
        }[]
      }
      bi_solucoes_ranking: {
        Args: { p_limite?: number }
        Returns: {
          avaliacoes: number
          categoria: string
          concluidas: number
          favoritos: number
          iniciadas: number
          nota: number
          pageviews: number
          publicada: boolean
          solucao: string
          taxa_conclusao: number
        }[]
      }
      bi_tempo_primeiro_valor: {
        Args: never
        Returns: {
          clientes: number
          faixa: string
          ordem: number
        }[]
      }
      bi_top_telas: {
        Args: {
          p_dias?: number
          p_limite?: number
          p_papel?: string
          p_plano?: string
        }
        Returns: {
          path: string
          usuarios: number
          views: number
        }[]
      }
      bi_ultima_sincronizacao: { Args: never; Returns: string }
      bi_uso_vs_receita: {
        Args: never
        Returns: {
          clientes: number
          dias_ativos_medio: number
          faixa: string
          ordem: number
          pct_ativos_30d: number
          receita_media: number
        }[]
      }
      bi_valor_nao_consumido: {
        Args: never
        Returns: {
          beneficiarios: number
          disponivel: number
          item: string
          pct_uso: number
          usado: number
        }[]
      }
      bi_visao_geral_kpis: {
        Args: { p_dias?: number; p_papel?: string; p_plano?: string }
        Returns: {
          ativos: number
          ativos_ant: number
          aulas: number
          aulas_ant: number
          novos: number
          novos_ant: number
          pageviews: number
          pageviews_ant: number
        }[]
      }
    }
    Enums: {
      consultor_planejamento_status:
        | "gathering"
        | "generating"
        | "ready"
        | "error"
      user_role: "admin" | "member"
      wa_thread_status: "open" | "closed" | "archived"
      wa_ticket_priority: "low" | "normal" | "high" | "urgent"
      wa_ticket_status:
        | "open"
        | "pending"
        | "waiting_third_party"
        | "solved"
        | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      consultor_planejamento_status: [
        "gathering",
        "generating",
        "ready",
        "error",
      ],
      user_role: ["admin", "member"],
      wa_thread_status: ["open", "closed", "archived"],
      wa_ticket_priority: ["low", "normal", "high", "urgent"],
      wa_ticket_status: [
        "open",
        "pending",
        "waiting_third_party",
        "solved",
        "closed",
      ],
    },
  },
} as const
