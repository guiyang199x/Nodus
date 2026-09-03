'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult, WorkspaceRole } from '@knowledge/domain';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { createInvitationMailer } from './invitation-mailer';
import { inviteMember } from './invitation-service';
import { CreateTeamSchema, InviteMemberSchema } from './schemas';

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

export async function createTeamWorkspaceAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = CreateTeamSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: '请检查团队名称和网址标识' } };
  }
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc('create_team_workspace', {
    workspace_name: parsed.data.name,
    workspace_slug: parsed.data.slug,
    correlation_id: randomUUID(),
  });
  if (error || !data) {
    return { ok: false, error: { code: 'CONFLICT', message: '团队网址标识已被使用' } };
  }
  revalidatePath('/', 'layout');
  return { ok: true, data: { workspaceId: data } };
}

export async function createInvitationAction(
  input: unknown
): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
  const parsed = InviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: '请检查邮箱和角色' } };
  }
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: { code: 'AUTH_REQUIRED', message: '请先登录' } };

  // Both reads are RLS-scoped, so an unauthorised caller cannot use this to
  // learn a workspace name.
  const [{ data: workspace }, { data: profile }] = await Promise.all([
    client.from('workspaces').select('name').eq('id', parsed.data.workspaceId).single(),
    client.from('profiles').select('display_name').eq('id', user.id).single(),
  ]);
  if (!workspace || !profile) {
    return { ok: false, error: { code: 'FORBIDDEN', message: '无法读取邀请上下文' } };
  }

  const result = await inviteMember(client, createInvitationMailer(), {
    ...parsed.data,
    workspaceName: workspace.name,
    inviterName: profile.display_name,
    appUrl: process.env.APP_URL!,
    requestId: randomUUID(),
  });
  if (result.ok) revalidatePath(`/w/${parsed.data.workspaceId}/settings/members`);
  return result;
}

export async function revokeInvitationAction(
  workspaceId: string,
  invitationId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('revoke_invitation', {
    target_workspace_id: workspaceId,
    target_invitation_id: invitationId,
    correlation_id: randomUUID(),
  });
  if (error) return { ok: false, error: { code: 'FORBIDDEN', message: '你不能撤销此邀请' } };
  revalidatePath(`/w/${workspaceId}/settings/members`);
  return { ok: true, data: undefined };
}

export async function changeMemberRoleAction(
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, 'owner'>
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('change_member_role', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    new_role: role,
    correlation_id: randomUUID(),
  });
  if (error) return { ok: false, error: { code: 'FORBIDDEN', message: '你不能修改此成员角色' } };
  revalidatePath(`/w/${workspaceId}/settings/members`);
  return { ok: true, data: undefined };
}

export async function removeMemberAction(
  workspaceId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('remove_member', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    correlation_id: randomUUID(),
  });
  if (error) return { ok: false, error: { code: 'FORBIDDEN', message: '你不能移除此成员' } };
  revalidatePath(`/w/${workspaceId}/settings/members`);
  return { ok: true, data: undefined };
}

export async function transferOwnershipAction(
  workspaceId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('transfer_workspace_ownership', {
    target_workspace_id: workspaceId,
    new_owner_user_id: userId,
    correlation_id: randomUUID(),
  });
  if (error) return { ok: false, error: { code: 'FORBIDDEN', message: '所有权转移失败' } };
  revalidatePath(`/w/${workspaceId}/settings/members`);
  return { ok: true, data: undefined };
}
