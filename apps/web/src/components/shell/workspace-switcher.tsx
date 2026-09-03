'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setLastWorkspaceAction } from '@/features/workspaces/actions';
import type { WorkspaceSummary } from '@/features/workspaces/queries';

export function WorkspaceSwitcher({
  currentId,
  workspaces,
}: {
  currentId: string;
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="sr-only" htmlFor="workspace-switcher">
        当前工作区
      </label>
      <select
        id="workspace-switcher"
        value={currentId}
        disabled={pending}
        className="min-h-11 w-full rounded-[var(--radius-control)] bg-transparent px-2 font-medium"
        onChange={(event) => {
          const workspaceId = event.currentTarget.value;
          setError('');
          startTransition(async () => {
            // The database decides; a denial is shown, never worked around.
            const result = await setLastWorkspaceAction(workspaceId);
            if (!result.ok) return setError(result.error.message);
            router.push(`/w/${workspaceId}/library`);
          });
        }}
      >
        {workspaces.map((workspace) => (
          <option value={workspace.id} key={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <p aria-live="polite" className="px-2 text-xs text-[var(--danger)] empty:hidden">
        {error}
      </p>
    </div>
  );
}
