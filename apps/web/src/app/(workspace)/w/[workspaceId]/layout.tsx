import { notFound } from 'next/navigation';

import { AppShell } from '@/components/shell/app-shell';
import { listAccessibleWorkspaces } from '@/features/workspaces/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';

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
  const context = await requireWorkspaceCapability(client, workspaceId, 'documents.read').catch(
    () => null
  );
  if (!context) notFound();
  const workspaces = await listAccessibleWorkspaces(client);
  return (
    <AppShell context={context} workspaces={workspaces}>
      {children}
    </AppShell>
  );
}
