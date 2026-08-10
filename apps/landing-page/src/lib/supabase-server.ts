import "server-only";

import { createClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      subscribe_email: {
        Args: { p_email: string };
        Returns: null;
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

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
