import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      subscribe_email: {
        Args: { p_email: string };
        Returns: null;
      };
      consume_waitlist_rate_limit: {
        Args: {
          p_keys: string[];
          p_max_requests: number;
          p_window_ms: number;
        };
        Returns: number;
      };
      confirm_subscription: {
        Args: { p_token: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, string>;
    CompositeTypes: Record<never, never>;
  };
};

let supabaseAdmin: SupabaseClient<Database> | null = null;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(
      requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdmin;
}
