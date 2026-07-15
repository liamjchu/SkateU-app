export { };

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      SUPABASE_ANON_KEY?: string;
      EXPO_PUBLIC_SUPABASE_URL?: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
      EXPO_PUBLIC_API_URL?: string;
      OPENAI_API_KEY?: string;
    }
  }
}
