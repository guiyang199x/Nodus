import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, WorkspaceKind, WorkspaceRole } from '@knowledge/domain';

export type WorkspaceSummary = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  role: WorkspaceRole;
};

export async function listAccessibleWorkspaces(
  client: SupabaseClient<Database>
): Promise<WorkspaceSummary[]> {
  // RLS lets a member read every membership row in a workspace they belong to,
  // teammates' rows included. Without this filter a five person team would
  // return the same workspace five times.
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('无法读取工作区');

  const { data, error } = await client
    .from('memberships')
    .select('role, workspaces!inner(id,name,kind,state)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('workspaces.state', 'ACTIVE')
    .order('joined_at', { ascending: true });
  if (error) throw new Error('无法读取工作区');
  return data.map((row) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    kind: row.workspaces.kind,
    role: row.role,
  }));
}
