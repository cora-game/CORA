import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

export const supabase = {
  async rpc(name: string, args?: Record<string, unknown>) {
    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: new Error('Supabase is not configured.'),
      };
    }

    const client = await getClient();
    return client.rpc(name, args);
  },
};

export function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  );
  return clientPromise;
}
