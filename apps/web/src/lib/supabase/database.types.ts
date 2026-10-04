// Types for the public schema. Regenerate with `pnpm db:types` after every migration (needs the
// local Supabase stack); CI fails when this file is out of date.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      answers: {
        Row: {
          confidence: string;
          normalized_value: Json;
          project_id: string;
          question_id: string;
          raw_text: string | null;
          source: string;
          updated_at: string;
          validated: boolean;
        };
        Insert: {
          confidence: string;
          normalized_value: Json;
          project_id: string;
          question_id: string;
          raw_text?: string | null;
          source: string;
          updated_at?: string;
          validated?: boolean;
        };
        Update: {
          confidence?: string;
          normalized_value?: Json;
          project_id?: string;
          question_id?: string;
          raw_text?: string | null;
          source?: string;
          updated_at?: string;
          validated?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'answers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      consent_events: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          kind: string;
          locale: string;
          text_version: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          kind: string;
          locale: string;
          text_version: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          locale?: string;
          text_version?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          country_code: string;
          created_at: string;
          has_project: boolean | null;
          locale: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          has_project?: boolean | null;
          locale?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          has_project?: boolean | null;
          locale?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          mode: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          currency: string;
          id?: string;
          mode?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          mode?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      tool_runs: {
        Row: {
          cache_read_tokens: number;
          cache_write_tokens: number;
          cost_usd: number;
          created_at: string;
          engine_version: string | null;
          id: number;
          input_hash: string;
          model: string | null;
          output: Json;
          project_id: string;
          prompt_version: string | null;
          search_calls: number;
          tokens_in: number;
          tokens_out: number;
          tool_id: string;
        };
        Insert: {
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          cost_usd?: number;
          created_at?: string;
          engine_version?: string | null;
          id?: never;
          input_hash: string;
          model?: string | null;
          output: Json;
          project_id: string;
          prompt_version?: string | null;
          search_calls?: number;
          tokens_in?: number;
          tokens_out?: number;
          tool_id: string;
        };
        Update: {
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          cost_usd?: number;
          created_at?: string;
          engine_version?: string | null;
          id?: never;
          input_hash?: string;
          model?: string | null;
          output?: Json;
          project_id?: string;
          prompt_version?: string | null;
          search_calls?: number;
          tokens_in?: number;
          tokens_out?: number;
          tool_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tool_runs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_counters: {
        Row: {
          count: number;
          key: string;
          period_start: string;
          user_id: string;
        };
        Insert: {
          count?: number;
          key: string;
          period_start: string;
          user_id: string;
        };
        Update: {
          count?: number;
          key?: string;
          period_start?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          p_country_code: string;
          p_crossborder_consent: boolean;
          p_crossborder_version: string;
          p_has_project: boolean;
          p_locale: string;
          p_terms_version: string;
        };
        Returns: string;
      };
      create_project: {
        Args: {
          p_country_code: string;
          p_currency: string;
          p_mode: string;
          p_title: string;
        };
        Returns: string;
      };
      delete_my_account: { Args: never; Returns: undefined };
      has_crossborder_consent: { Args: never; Returns: boolean };
      record_ai_run: {
        Args: {
          p_cache_read_tokens: number;
          p_cache_write_tokens: number;
          p_input_hash: string;
          p_model: string;
          p_output: Json;
          p_project_id: string;
          p_prompt_version: string;
          p_reservation: string;
          p_tokens_in: number;
          p_tokens_out: number;
          p_tool_id: string;
        };
        Returns: number;
      };
      record_tool_run: {
        Args: {
          p_cache_read_tokens: number;
          p_cache_write_tokens: number;
          p_cost_usd: number;
          p_input_hash: string;
          p_model: string;
          p_output: Json;
          p_project_id: string;
          p_prompt_version: string;
          p_tokens_in: number;
          p_tokens_out: number;
          p_tool_id: string;
        };
        Returns: number;
      };
      reserve_ai_call: { Args: never; Returns: boolean };
      reserve_ai_run: { Args: never; Returns: Json };
      set_crossborder_consent: {
        Args: { p_given: boolean; p_text_version: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
