import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

// The URL carries a one-time token, so it must not leak through a referrer.
export const metadata = { title: '接受团队邀请', referrer: 'no-referrer' } as const;
export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: failed } = await searchParams;
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  async function accept() {
    'use server';
    const serverClient = await createServerSupabaseClient();
    const { data: workspaceId, error } = await serverClient.rpc('accept_invitation', {
      raw_token: token,
      correlation_id: randomUUID(),
    });
    if (error || !workspaceId) redirect(`/invite/${token}?error=invalid`);
    redirect(`/w/${workspaceId}/library`);
  }

  return (
    <main className="page-content">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">接受团队邀请</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        邀请只可使用一次，并且必须与当前登录邮箱一致。
      </p>
      <form action={accept} className="mt-6">
        <button className="min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)]">
          接受邀请
        </button>
      </form>
      {failed && (
        <p role="alert" className="mt-4 text-sm text-[var(--danger)]">
          这个邀请已失效、已被使用，或与当前登录邮箱不一致。
        </p>
      )}
    </main>
  );
}
