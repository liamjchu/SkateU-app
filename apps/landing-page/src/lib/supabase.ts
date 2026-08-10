import { createClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, string>;
    CompositeTypes: Record<never, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
