import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const defaultSupabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://vwoskusxfzmnoawbrpnr.supabase.co';

const defaultSupabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3b3NrdXN4Znptbm9hd2JycG5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjcwNDczMiwiZXhwIjoyMTA4MjgwNzMyfQ.5zT9Gw3C1AI2IKDlpC9pmrm8BEh5-5M-Qw7f-edE1zk';

export const defaultSupabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_HVjFoLz84HMQ3ONultKhSA_rrnOtIpZ';

export { defaultSupabaseUrl, defaultSupabaseServiceKey };

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

function isLikelyServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed || trimmed.startsWith('sb_publishable_')) return false;
  if (trimmed.startsWith('sb_secret_')) return true;
  // Standard Supabase JWT: check if payload role === 'service_role'
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      return payload.role === 'service_role';
    } catch {
      return true;
    }
  }
  return true;
}

export function getActiveServerSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const url = (customUrl || defaultSupabaseUrl || '').trim();
  const candidateKey = (customKey || '').trim();
  // Never downgrade to an anon/publishable key when connecting to our Supabase instance
  const key =
    candidateKey && isLikelyServiceRoleKey(candidateKey)
      ? candidateKey
      : defaultSupabaseServiceKey;

  if (!url || !key || !url.startsWith('https://')) {
    return serverSupabase;
  }
  if (url === defaultSupabaseUrl && key === defaultSupabaseServiceKey && serverSupabase) {
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

export async function pingServerSupabase(
  customUrl?: string,
  customKey?: string
): Promise<{
  ok: boolean;
  connected: boolean;
  latencyMs: number;
  url: string;
  userCount?: number;
  details: string;
  error?: string;
}> {
  const startMs = Date.now();
  const url = (customUrl || defaultSupabaseUrl || '').trim();
  const sb = getActiveServerSupabase(customUrl, customKey);
  if (!sb) {
    const msg = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.';
    return { ok: false, connected: false, latencyMs: 0, url, details: msg, error: msg };
  }

  try {
    const { count, error } = await sb.from('users').select('id', { count: 'exact', head: true });
    const latencyMs = Math.max(1, Date.now() - startMs);
    if (error) {
      return { ok: false, connected: false, latencyMs, url, details: error.message, error: error.message };
    }
    const userCount = count ?? 0;
    return {
      ok: true,
      connected: true,
      latencyMs,
      url,
      userCount,
      details: `Connected to Supabase PostgreSQL (${userCount} users synced)`
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, connected: false, latencyMs: Math.max(1, Date.now() - startMs), url, details: msg, error: msg };
  }
}


