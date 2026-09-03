import type { SupabaseClient } from '@supabase/supabase-js';

import {
  WorkspaceContextSchema,
  type Capability,
  type Database,
  type WorkspaceContext,
} from '@knowledge/domain';

export class WorkspaceAccessError extends Error {
  readonly code = 'FORBIDDEN' as const;
}

export async function requireWorkspaceCapability(
  client: SupabaseClient<Database>,
  workspaceId: string,
  capability: Capability
): Promise<WorkspaceContext> {
  const { data, error } = await client
    .rpc('assert_workspace_capability', {
      target_workspace_id: workspaceId,
      requested_capability: capability,
    })
    .single();
  if (error || !data) throw new WorkspaceAccessError('你已无权访问此工作区或执行此操作');
  return WorkspaceContextSchema.parse({
    workspaceId: data.workspace_id,
    userId: data.user_id,
    role: data.role,
    kind: data.kind,
  });
}
