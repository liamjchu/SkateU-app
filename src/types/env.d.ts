export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      SUPABASE_ANON_KEY?: string;
      EXPO_PUBLIC_API_URL?: string;
    }
  }
}
