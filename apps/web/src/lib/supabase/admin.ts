import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@knowledge/domain';

/**
 * Holds the service role key, so it must never be imported from anything that
 * can reach the browser. The 'server-only' import above turns a mistake into a
 * build error rather than a leaked key.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}
