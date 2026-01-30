import { createClient } from "@supabase/supabase-js";

type SupabaseClientLike = ReturnType<typeof createClient> | null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClientLike =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
