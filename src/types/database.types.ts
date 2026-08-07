// Gerado a partir do schema do Supabase.
// Regenerar após qualquer migration com: npm run db:types
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
        Args: never
        Returns: {
          acao: string
          fizeram: number
          lift: number | null
          nao_fizeram: number
          ret_fizeram: number | null
          ret_nao_fizeram: number | null
        }[]
      }
      bi_amplitude_modulos: {
        Args: { p_dias?: number }
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
        Args: { p_dias?: number }
        Returns: {
          ativos: number
          data: string
        }[]
      }
      bi_churn_modulos: {
        Args: never
        Returns: {
          gap_pp: number | null
          medido_desde: string
          modulo: string
          pct_ativos_nunca_usou: number | null
          pct_churned_nunca_usou: number | null
        }[]
      }
      bi_churn_resumo: {
        Args: never
        Returns: {
          ativos: number
          churned: number
          pct_churn: number | null
          vida_media_dias: number | null
        }[]
      }
      bi_churn_ultimo_modulo: {
        Args: never
        Returns: {
          clientes: number
          modulo: string
        }[]
      }
      bi_clientes_em_risco: {
        Args: { p_limite?: number }
        Returns: {
          dias_ate_vencer: number | null
          dias_inativo: number | null
          email: string
          motivo: string
          nome: string
          organizacao: string | null
          plano: string | null
          ultima_atividade: string | null
        }[]
      }
      bi_dias_ativos_distribuicao: {
        Args: { p_dias?: number }
        Returns: {
          clientes: number
          faixa: string
          ordem: number
        }[]
      }
      bi_engajamento_clientes: {
        Args: { p_dias?: number }
        Returns: {
          dau_medio: number
          dias_ativos_medio: number
          mau: number
          pct_habito_semanal: number
          pct_multimodulo: number
          stickiness: number
        }[]
      }
      bi_entrada_kpis: {
        Args: { p_dias?: number }
        Returns: {
          conversao: number | null
          convites: number
          erros_login: number
          onboarding_pct: number | null
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
      bi_dropoff_posicao: {
        Args: never
        Returns: {
          decil: number
          taxa_media: number | null
        }[]
      }
      bi_duracao_ideal: {
        Args: never
        Returns: {
          aulas: number
          faixa: string
          ordem: number
          taxa_media: number | null
        }[]
      }
      bi_eventos_por_tipo: {
        Args: { p_dias?: number }
        Returns: {
          eventos: number
          tipo: string
        }[]
      }
      bi_formacoes_kpis: {
        Args: { p_dias?: number }
        Returns: {
          alunos_ativos: number
          aulas_concluidas: number
          certificados: number
          nps_medio: number | null
        }[]
      }
      bi_formacoes_uso: {
        Args: { p_dias?: number }
        Returns: {
          alunos: number
          alunos_historico: number
          aulas_concluidas: number
          categoria: string | null
          certificados_historico: number
          conclusao_historica: number | null
          curso: string
        }[]
      }
      bi_funil_entrada: {
        Args: { p_dias?: number }
        Returns: {
          etapa: string
          ordem: number
          pct_do_inicio: number | null
          quantidade: number
        }[]
      }
      bi_heatmap_navegacao: {
        Args: { p_dias?: number }
        Returns: {
          dia_semana: number
          hora: number
          pageviews: number
        }[]
      }
      bi_jornada_cursos: {
        Args: { p_min_certificados?: number }
        Returns: {
          certificados: number
          curso: string
          mediana_dias: number | null
        }[]
      }
      bi_masters_convites_resumo: {
        Args: never
        Returns: {
          conversao_convites: number | null
          masters_convidaram: number
          masters_total: number
          pct_convidam: number | null
        }[]
      }
      bi_masters_top_convidadores: {
        Args: { p_limite?: number }
        Returns: {
          conversao: number | null
          convites: number
          email: string
          nome: string
          organizacao: string | null
          usados: number
        }[]
      }
      bi_nps_cursos: {
        Args: { p_min_respostas?: number }
        Returns: {
          curso: string
          media: number | null
          pct_detratores: number | null
          pct_promotores: number | null
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
      bi_power_users: {
        Args: { p_dias?: number; p_limite?: number }
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
      bi_retencao_cohort: {
        Args: never
        Returns: {
          clientes: number
          cohort_mes: string
          ret_180d: number | null
          ret_30d: number | null
          ret_7d: number | null
          ret_90d: number | null
        }[]
      }
      bi_retencao_por_amplitude: {
        Args: never
        Returns: {
          clientes: number
          modulos: number
          pct_retidos: number
        }[]
      }
      bi_solucoes_candidatas_remocao: {
        Args: never
        Returns: {
          categoria: string | null
          concluidas: number
          favoritos: number
          iniciadas: number
          motivo: string
          nota: number | null
          pageviews: number
          solucao: string
        }[]
      }
      bi_solucoes_conversao_tela: {
        Args: { p_dias?: number }
        Returns: {
          etapa: string
          ordem: number
          pct: number | null
          usuarios: number
        }[]
      }
      bi_solucoes_funil_abas: {
        Args: never
        Returns: {
          aba: string
          ordem: number
          pct_do_topo: number | null
          usuarios: number
        }[]
      }
      bi_solucoes_kpis: {
        Args: { p_dias?: number }
        Returns: {
          concluidas_periodo: number
          iniciadas_periodo: number
          publicadas: number
          taxa_conclusao_historica: number | null
        }[]
      }
      bi_solucoes_por_categoria: {
        Args: never
        Returns: {
          categoria: string
          concluidas: number
          iniciadas: number
          solucoes: number
          taxa: number | null
        }[]
      }
      bi_solucoes_ranking: {
        Args: { p_limite?: number }
        Returns: {
          avaliacoes: number
          categoria: string | null
          concluidas: number
          favoritos: number
          iniciadas: number
          nota: number | null
          pageviews: number
          publicada: boolean
          solucao: string
          taxa_conclusao: number | null
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
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          path: string
          usuarios: number
          views: number
        }[]
      }
      bi_ultima_sincronizacao: { Args: never; Returns: string }
      bi_visao_geral_kpis: {
        Args: { p_dias?: number }
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
    },
  },
} as const
