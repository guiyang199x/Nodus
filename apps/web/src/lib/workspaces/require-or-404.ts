import { notFound } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Capability, Database, WorkspaceContext } from '@knowledge/domain';

import { requireWorkspaceCapability } from './access';

/**
 * A workspace you may not see must be indistinguishable from one that does not
 * exist, so a denial becomes 404 rather than a server error. Pages call this
 * rather than requireWorkspaceCapability directly: the layout and the page
 * render concurrently, so an uncaught throw in the page can surface as a 500
 * before the layout's own guard runs.
 */
export async function requireWorkspaceOr404(
  client: SupabaseClient<Database>,
  workspaceId: string,
  capability: Capability
): Promise<WorkspaceContext> {
  try {
    return await requireWorkspaceCapability(client, workspaceId, capability);
  } catch {
    notFound();
  }
}
