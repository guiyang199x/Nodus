'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@knowledge/domain';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function setLastWorkspaceAction(
  workspaceId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('set_last_workspace', { target_workspace_id: workspaceId });
  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: '你已无法切换到这个工作区' } };
  }
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}
