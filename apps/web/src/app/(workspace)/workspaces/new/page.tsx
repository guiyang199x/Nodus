import { CreateTeamForm } from '@/features/workspaces/create-team-form';

export const metadata = { title: '创建团队空间' };
// A private page behind the proxy renders dynamically, never from a shared
// prerendered response.
export const dynamic = 'force-dynamic';

export default function NewTeamPage() {
  return (
    <main className="page-content">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">创建团队空间</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">团队资料默认对所有有效成员可见。</p>
      <CreateTeamForm />
    </main>
  );
}
