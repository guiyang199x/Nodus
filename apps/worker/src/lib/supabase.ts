/**
 * Supabase client for worker
 *
 * Uses service role key for privileged operations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export function createSupabaseClient() {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type WorkerSupabaseClient = ReturnType<typeof createSupabaseClient>;

let supabaseClient: WorkerSupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}
