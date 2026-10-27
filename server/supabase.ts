import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isServerSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

export const serverSupabase: SupabaseClient | null = isServerSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

export async function pingServerSupabase(): Promise<{ ok: boolean; details: string }> {
  if (!serverSupabase) {
    return { ok: false, details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables not set on server.' };
  }

  try {
    const { data, error } = await serverSupabase.from('system_settings').select('*').limit(1);
    if (error) {
      return { ok: false, details: error.message };
    }
    return { ok: true, details: 'Connected to Supabase PostgreSQL database!' };
  } catch (err) {
    return { ok: false, details: err instanceof Error ? err.message : String(err) };
  }
}
