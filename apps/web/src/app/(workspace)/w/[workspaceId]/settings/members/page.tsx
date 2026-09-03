import { MemberManager } from '@/features/workspaces/member-manager';
import { getMemberSettings } from '@/features/workspaces/member-queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceOr404 } from '@/lib/workspaces/require-or-404';

export const metadata = { title: '成员与邀请' };
export const dynamic = 'force-dynamic';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceOr404(client, workspaceId, 'documents.read');
  const settings = await getMemberSettings(client, workspaceId);
  return (
    <div className="page-content">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">成员与邀请</h1>
      {context.kind === 'personal' ? (
        <p className="mt-4 text-[var(--muted)]">个人空间只有你本人，不能邀请其他成员。</p>
      ) : (
        <MemberManager
          workspaceId={workspaceId}
          currentUserId={context.userId}
          currentRole={context.role}
          members={settings.members}
          invitations={settings.invitations}
        />
      )}
    </div>
  );
}
