import { AppShell } from '@/components/shell/app-shell';
import { listAccessibleWorkspaces } from '@/features/workspaces/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceOr404 } from '@/lib/workspaces/require-or-404';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  // The database decides membership; a denial is indistinguishable from a
  // workspace that does not exist.
  const context = await requireWorkspaceOr404(client, workspaceId, 'documents.read');
  const workspaces = await listAccessibleWorkspaces(client);
  return (
    <AppShell context={context} workspaces={workspaces}>
      {children}
    </AppShell>
  );
}
