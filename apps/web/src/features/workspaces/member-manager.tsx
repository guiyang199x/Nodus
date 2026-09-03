'use client';

import { useState, useTransition } from 'react';

import type { WorkspaceRole } from '@knowledge/domain';

import {
  changeMemberRoleAction,
  createInvitationAction,
  removeMemberAction,
  revokeInvitationAction,
  transferOwnershipAction,
} from './actions';
import { ROLE_LABELS } from './role-labels';

type Member = { user_id: string; role: WorkspaceRole; profiles: { display_name: string } };
type Invitation = { id: string; email: string; role: WorkspaceRole; expires_at: string };

const control =
  'min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-3 bg-white';

export function MemberManager(props: {
  workspaceId: string;
  currentUserId: string;
  currentRole: WorkspaceRole;
  members: Member[];
  invitations: Invitation[];
}) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  // Admin manages Editor and Viewer only; Owner alone manages Admin. The
  // database enforces this too - these options only keep the UI honest.
  const roles =
    props.currentRole === 'owner'
      ? (['admin', 'editor', 'viewer'] as const)
      : (['editor', 'viewer'] as const);
  const canManageMembers = props.currentRole === 'owner' || props.currentRole === 'admin';

  const run = (action: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? done : (result.error?.message ?? '操作失败'));
    });

  return (
    <section className="mt-8">
      {canManageMembers && (
        <form
          className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const element = event.currentTarget;
            startTransition(async () => {
              const result = await createInvitationAction({
                workspaceId: props.workspaceId,
                email: form.get('email'),
                role: form.get('role'),
              });
              setMessage(result.ok ? '邀请已发送' : result.error.message);
              if (result.ok) element.reset();
            });
          }}
        >
          <input
            aria-label="邀请邮箱"
            name="email"
            type="email"
            required
            placeholder="name@company.com"
            className={`${control} flex-1`}
          />
          <select aria-label="邀请角色" name="role" defaultValue="viewer" className={control}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            className="min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            发送邀请
          </button>
        </form>
      )}

      <h2 className="mt-6 text-lg font-medium">成员</h2>
      <ul className="divide-y divide-[var(--line)]">
        {props.members.map((member) => {
          const isSelf = member.user_id === props.currentUserId;
          const canManage =
            props.currentRole === 'owner'
              ? member.role !== 'owner'
              : member.role !== 'owner' && member.role !== 'admin' && !isSelf;
          return (
            <li key={member.user_id} className="flex min-h-14 flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                {member.profiles.display_name}
                {isSelf && <span className="ml-2 text-xs text-[var(--muted)]">（你）</span>}
              </span>
              {canManage ? (
                <>
                  <select
                    aria-label={`修改 ${member.profiles.display_name} 的角色`}
                    defaultValue={member.role}
                    disabled={pending}
                    className={control}
                    onChange={(event) =>
                      run(
                        () =>
                          changeMemberRoleAction(
                            props.workspaceId,
                            member.user_id,
                            event.target.value as Exclude<WorkspaceRole, 'owner'>
                          ),
                        '角色已更新'
                      )
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    className="min-h-11 px-2 text-sm hover:underline"
                    onClick={() =>
                      run(() => removeMemberAction(props.workspaceId, member.user_id), '成员已移除')
                    }
                  >
                    移除
                  </button>
                  {props.currentRole === 'owner' && (
                    <button
                      type="button"
                      disabled={pending}
                      className="min-h-11 px-2 text-sm hover:underline"
                      onClick={() => {
                        // Transfer is one way: it demotes the current owner to
                        // admin and cannot be undone without the new owner.
                        const ok = window.confirm(
                          `把所有权转移给 ${member.profiles.display_name}？你会降为管理员，且无法自行撤销。`
                        );
                        if (ok) {
                          run(
                            () => transferOwnershipAction(props.workspaceId, member.user_id),
                            '所有权已转移'
                          );
                        }
                      }}
                    >
                      转移所有权
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm text-[var(--muted)]">{ROLE_LABELS[member.role]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {canManageMembers && (
        <>
          <h2 className="mt-8 text-lg font-medium">待接受的邀请</h2>
          {props.invitations.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">没有待接受的邀请。</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {props.invitations.map((invitation) => (
                <li key={invitation.id} className="flex min-h-14 flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
                  <span className="text-sm text-[var(--muted)]">
                    {ROLE_LABELS[invitation.role]}
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {new Date(invitation.expires_at).toLocaleDateString('zh-CN')} 过期
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    className="min-h-11 px-2 text-sm hover:underline"
                    onClick={() =>
                      run(
                        () => revokeInvitationAction(props.workspaceId, invitation.id),
                        '邀请已撤销'
                      )
                    }
                  >
                    撤销
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p aria-live="polite" className="mt-4 text-sm text-[var(--muted)] empty:hidden">
        {message}
      </p>
    </section>
  );
}
