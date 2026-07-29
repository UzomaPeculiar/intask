type SupabaseClientEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_PROJECT_ID?: string;
};

const DEFAULT_SUPABASE_PROJECT_ID = "tjepeveyluwxohhbsqod";
const DEFAULT_SUPABASE_URL = `https://${DEFAULT_SUPABASE_PROJECT_ID}.supabase.co`;
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aaV165iyyzPupmmYYGWtTw_UOriGmXm";

declare global {
  interface Window {
    __INTASK_ENV__?: SupabaseClientEnv;
  }
}

function readSupabaseClientEnv(): SupabaseClientEnv {
  const injected = typeof window !== "undefined" ? window.__INTASK_ENV__ : undefined;
  return {
    SUPABASE_URL:
      (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
      injected?.SUPABASE_URL ||
      process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
      injected?.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY,
    SUPABASE_PROJECT_ID:
      (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ||
      injected?.SUPABASE_PROJECT_ID ||
      DEFAULT_SUPABASE_PROJECT_ID,
  };
}

export function getSupabaseClientConfig() {
  const env = readSupabaseClientEnv();
  const supabaseUrl =
    env.SUPABASE_URL ||
    (env.SUPABASE_PROJECT_ID ? `https://${env.SUPABASE_PROJECT_ID}.supabase.co` : undefined) ||
    DEFAULT_SUPABASE_URL;

  return {
    supabaseUrl,
    supabaseKey: env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function hasSupabaseClientConfig() {
  const { supabaseUrl, supabaseKey } = getSupabaseClientConfig();
  return Boolean(supabaseUrl && supabaseKey);
}