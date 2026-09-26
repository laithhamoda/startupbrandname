// Types for the public schema. Regenerate with `pnpm db:types` after every migration (needs the
// local Supabase stack); CI fails when this file is out of date.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
          adult_declared_at: string;
          country_code: string;
          created_at: string;
          locale: string;
          secondary_declared_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          adult_declared_at: string;
          country_code: string;
          created_at?: string;
          locale?: string;
          secondary_declared_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          adult_declared_at?: string;
          country_code?: string;
          created_at?: string;
          locale?: string;
          secondary_declared_at?: string;
          updated_at?: string;
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
          p_adult: boolean;
          p_country_code: string;
          p_crossborder_consent: boolean;
          p_crossborder_version: string;
          p_locale: string;
          p_secondary_completed: boolean;
          p_terms_version: string;
        };
        Returns: string;
      };
      delete_my_account: { Args: never; Returns: undefined };
      has_crossborder_consent: { Args: never; Returns: boolean };
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
