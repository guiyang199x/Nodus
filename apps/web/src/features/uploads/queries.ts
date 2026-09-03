import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@knowledge/domain';

export async function listWorkspaceDocuments(
  client: SupabaseClient<Database>,
  workspaceId: string
) {
  const { data, error } = await client
    .from('documents')
    .select('id,title,status,updated_at,uploaded_by')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('无法读取资料库');
  return data;
}

export type WorkspaceDocument = Awaited<ReturnType<typeof listWorkspaceDocuments>>[number];
