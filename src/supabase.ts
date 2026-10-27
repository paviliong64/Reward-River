import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://your-supabase-project.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'your-supabase-anon-key';

export const isSupabaseConfigured = Boolean(
  (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL) &&
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message: 'Supabase URL or Anon Key not configured in client environment variables.'
    };
  }

  try {
    const { data, error } = await supabase.from('system_settings').select('count').limit(1);
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Supabase connection verified successfully!' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to connect to Supabase.'
    };
  }
}
