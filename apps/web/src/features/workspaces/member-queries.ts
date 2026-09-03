import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@knowledge/domain';

/**
 * Both reads are RLS-scoped. Invitations are only visible to a caller with a
 * member-management capability, so a viewer sees an empty list rather than an
 * error.
 */
export async function getMemberSettings(client: SupabaseClient<Database>, workspaceId: string) {
  const [{ data: members, error: memberError }, { data: invitations, error: inviteError }] =
    await Promise.all([
      client
        .from('memberships')
        .select('user_id,role,status,joined_at,profiles!inner(display_name)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true }),
      client
        .from('invitations')
        .select('id,email,role,expires_at,accepted_at,revoked_at')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false }),
    ]);
  if (memberError || inviteError) throw new Error('无法读取成员设置');
  return { members: members ?? [], invitations: invitations ?? [] };
}

export type MemberSettings = Awaited<ReturnType<typeof getMemberSettings>>;
