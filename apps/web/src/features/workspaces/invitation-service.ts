import type { SupabaseClient } from '@supabase/supabase-js';

import type { ActionResult, Database, WorkspaceRole } from '@knowledge/domain';

import type { InvitationMailer } from './invitation-mailer';

type InviteInput = {
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  appUrl: string;
  requestId: string;
};

/**
 * The raw invitation token exists in exactly one place outside the database:
 * the email body. It is never part of the value handed back to the browser.
 * If delivery fails the invitation is revoked, so a token that was possibly
 * written to a dead mailbox cannot later be redeemed.
 */
export async function inviteMember(
  client: SupabaseClient<Database>,
  mailer: InvitationMailer,
  input: InviteInput
): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
  const { data, error } = await client.rpc('create_invitation', {
    target_workspace_id: input.workspaceId,
    target_email: input.email,
    target_role: input.role,
    correlation_id: input.requestId,
  });
  const invitation = data?.[0];
  if (error || !invitation) {
    return { ok: false, error: { code: 'FORBIDDEN', message: '无法创建此邀请' } };
  }

  try {
    await mailer.send({
      to: input.email,
      inviterName: input.inviterName,
      workspaceName: input.workspaceName,
      role: input.role,
      acceptUrl: `${input.appUrl}/invite/${invitation.raw_token}`,
      expiresAt: invitation.expires_at,
    });
  } catch {
    await client.rpc('revoke_invitation', {
      target_workspace_id: input.workspaceId,
      target_invitation_id: invitation.invitation_id,
      correlation_id: input.requestId,
    });
    return {
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: '邀请邮件发送失败，邀请已撤销' },
    };
  }

  return {
    ok: true,
    data: { invitationId: invitation.invitation_id, expiresAt: invitation.expires_at },
  };
}
