import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const defaultSupabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const defaultSupabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isServerSupabaseConfigured = Boolean(defaultSupabaseUrl && defaultSupabaseServiceKey);

export const serverSupabase: SupabaseClient | null = isServerSupabaseConfigured
  ? createClient(defaultSupabaseUrl, defaultSupabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

let cachedDynamicClient: { url: string; key: string; client: SupabaseClient } | null = null;

export function getActiveServerSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const url = (customUrl || defaultSupabaseUrl || '').trim();
  const key = (customKey || defaultSupabaseServiceKey || '').trim();
  if (!url || !key || !url.startsWith('https://')) {
    return serverSupabase;
  }
  if (cachedDynamicClient && cachedDynamicClient.url === url && cachedDynamicClient.key === key) {
    return cachedDynamicClient.client;
  }
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  cachedDynamicClient = { url, key, client };
  return client;
}

export async function pingServerSupabase(customUrl?: string, customKey?: string): Promise<{ ok: boolean; details: string }> {
  const sb = getActiveServerSupabase(customUrl, customKey);
  if (!sb) {
    return { ok: false, details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.' };
  }

  try {
    const { error } = await sb.from('users').select('id').limit(1);
    if (error) {
      return { ok: false, details: error.message };
    }
    return { ok: true, details: 'Connected to Supabase PostgreSQL database!' };
  } catch (err) {
    return { ok: false, details: err instanceof Error ? err.message : String(err) };
  }
}

