import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ShopOrderPaymentStatus = "paid" | "unpaid" | "no_payment_required";

type ShopOrderRow = {
  id: string;
  session_id: string;
  email: string | null;
  product_slug: string;
  quantity: number;
  amount_total: number | null;
  currency: string;
  payment_status: ShopOrderPaymentStatus;
  shipping_name: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  created_at: string;
  updated_at: string;
};

type ShopOrderInsert = Omit<ShopOrderRow, "id" | "created_at" | "updated_at">;

type Database = {
  public: {
    Tables: {
      shop_orders: {
        Row: ShopOrderRow;
        Insert: ShopOrderInsert;
        Update: Partial<ShopOrderInsert>;
        Relationships: [];
      };
    };
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
