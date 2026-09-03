import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EntryPage() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: workspaceId, error } = await client.rpc('resolve_entry_workspace');
  if (error || !workspaceId) throw new Error('无法确定可访问的工作区');
  redirect(`/w/${workspaceId}/library`);
}
