// Types for the public schema. Regenerate with `pnpm db:types` after every migration (needs the
// local Supabase stack); CI fails when this file is out of date.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      answers: {
        Row: {
          confidence: string;
          normalized_value: NonNullable<Json>;
          project_id: string;
          question_id: string;
          raw_text: string | null;
          source: string;
          updated_at: string;
          validated: boolean;
        };
        Insert: {
          confidence: string;
          normalized_value: NonNullable<Json>;
          project_id: string;
          question_id: string;
          raw_text?: string | null;
          source: string;
          updated_at?: string;
          validated?: boolean;
        };
        Update: {
          confidence?: string;
          normalized_value?: NonNullable<Json>;
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
      billing_products: {
        Row: {
          active: boolean;
          created_at: string;
          plan_id: string;
          provider: string;
          provider_price_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          plan_id: string;
          provider: string;
          provider_price_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          plan_id?: string;
          provider?: string;
          provider_price_id?: string;
        };
        Relationships: [];
      };
      checkout_refs: {
        Row: {
          adult_confirmed_at: string;
          created_at: string;
          expires_at: string;
          plan_id: string;
          ref: string;
          user_id: string;
        };
        Insert: {
          adult_confirmed_at: string;
          created_at?: string;
          expires_at?: string;
          plan_id: string;
          ref?: string;
          user_id: string;
        };
        Update: {
          adult_confirmed_at?: string;
          created_at?: string;
          expires_at?: string;
          plan_id?: string;
          ref?: string;
          user_id?: string;
        };
        Relationships: [];
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
      country_pack_items: {
        Row: {
          country_code: string;
          created_at: string;
          id: string;
          key: string;
          last_verified: string | null;
          source_domain: string;
          source_url: string;
          status: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          id?: string;
          key: string;
          last_verified?: string | null;
          source_domain: string;
          source_url: string;
          status: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          id?: string;
          key?: string;
          last_verified?: string | null;
          source_domain?: string;
          source_url?: string;
          status?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          event_id: string;
          event_type: string;
          occurred_at: string;
          outcome: string;
          provider: string;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          occurred_at: string;
          outcome: string;
          provider: string;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          occurred_at?: string;
          outcome?: string;
          provider?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          id: string;
          occurred_at: string;
          provider: string;
          provider_ref: string | null;
          provider_transaction_id: string;
          status: string;
          subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency: string;
          id?: string;
          occurred_at: string;
          provider: string;
          provider_ref?: string | null;
          provider_transaction_id: string;
          status: string;
          subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          occurred_at?: string;
          provider?: string;
          provider_ref?: string | null;
          provider_transaction_id?: string;
          status?: string;
          subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
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
      reports: {
        Row: {
          audience: string | null;
          created_at: string;
          engine_version: string;
          id: string;
          input_hash: string;
          kind: string;
          locale: string;
          pdf_bytes: number;
          pdf_path: string;
          project_id: string;
        };
        Insert: {
          audience?: string | null;
          created_at?: string;
          engine_version: string;
          id?: string;
          input_hash: string;
          kind: string;
          locale: string;
          pdf_bytes: number;
          pdf_path: string;
          project_id: string;
        };
        Update: {
          audience?: string | null;
          created_at?: string;
          engine_version?: string;
          id?: string;
          input_hash?: string;
          kind?: string;
          locale?: string;
          pdf_bytes?: number;
          pdf_path?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          plan_id: string;
          provider_customer_id: string | null;
          provider_event_at: string | null;
          provider_ref: string | null;
          source: string;
          starts_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id: string;
          provider_customer_id?: string | null;
          provider_event_at?: string | null;
          provider_ref?: string | null;
          source: string;
          starts_at: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id?: string;
          provider_customer_id?: string | null;
          provider_event_at?: string | null;
          provider_ref?: string | null;
          source?: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tax_rules: {
        Row: {
          basis: string;
          brackets: NonNullable<Json>;
          ceiling: number | null;
          country_code: string;
          created_at: string;
          currency: string;
          effective_from: string;
          fixed_amount: number | null;
          id: string;
          kind: string;
          last_verified: string | null;
          legal_form: string;
          levy: string;
          min_amount: number | null;
          payment_month: number;
          rate: string | null;
          regime: string;
          source_url: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          basis: string;
          brackets?: NonNullable<Json>;
          ceiling?: number | null;
          country_code: string;
          created_at?: string;
          currency: string;
          effective_from: string;
          fixed_amount?: number | null;
          id?: string;
          kind: string;
          last_verified?: string | null;
          legal_form: string;
          levy: string;
          min_amount?: number | null;
          payment_month: number;
          rate?: string | null;
          regime: string;
          source_url: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          basis?: string;
          brackets?: NonNullable<Json>;
          ceiling?: number | null;
          country_code?: string;
          created_at?: string;
          currency?: string;
          effective_from?: string;
          fixed_amount?: number | null;
          id?: string;
          kind?: string;
          last_verified?: string | null;
          legal_form?: string;
          levy?: string;
          min_amount?: number | null;
          payment_month?: number;
          rate?: string | null;
          regime?: string;
          source_url?: string;
          status?: string;
          updated_at?: string;
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
          output: NonNullable<Json>;
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
          output: NonNullable<Json>;
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
          output?: NonNullable<Json>;
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
      apply_payment_event: {
        Args: {
          p_change: Json;
          p_event_id: string;
          p_event_type: string;
          p_occurred_at: string;
          p_provider: string;
        };
        Returns: string;
      };
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
        Args: { p_country_code: string; p_currency: string; p_mode: string; p_title: string };
        Returns: string;
      };
      crossborder_consent_state: { Args: Record<PropertyKey, never>; Returns: string };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
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
      record_engine_run: {
        Args: {
          p_engine_version: string;
          p_input_hash: string;
          p_output: Json;
          p_project_id: string;
          p_tool_id: string;
        };
        Returns: number;
      };
      record_report: {
        Args: {
          p_audience: string;
          p_engine_version: string;
          p_input_hash: string;
          p_kind: string;
          p_locale: string;
          p_pdf_bytes: number;
          p_pdf_path: string;
          p_project_id: string;
          p_report_id: string;
        };
        Returns: string;
      };
      reserve_ai_run: { Args: Record<PropertyKey, never>; Returns: Json };
      set_crossborder_consent: {
        Args: { p_given: boolean; p_text_version: string };
        Returns: undefined;
      };
      start_checkout: {
        Args: { p_adult_confirmed: boolean; p_plan_id: string };
        Returns: string;
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
