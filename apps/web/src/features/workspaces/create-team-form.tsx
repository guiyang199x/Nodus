'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createTeamWorkspaceAction } from './actions';

export function CreateTeamForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-6 max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError('');
        startTransition(async () => {
          const result = await createTeamWorkspaceAction({
            name: String(form.get('name')),
            slug: String(form.get('slug')),
          });
          if (!result.ok) return setError(result.error.message);
          router.push(`/w/${result.data.workspaceId}/library`);
        });
      }}
    >
      <label className="block text-sm font-medium">
        团队名称
        <input
          name="name"
          required
          maxLength={80}
          className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        网址标识
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9-]{2,62}"
          className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
        />
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
          3–63 个字符，只能使用小写字母、数字和连字符。
        </span>
      </label>
      <button
        disabled={pending}
        className="min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-white transition-colors duration-150 hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {pending ? '正在创建' : '创建团队'}
      </button>
      <p role="alert" className="text-sm text-[var(--danger)] empty:hidden">
        {error}
      </p>
    </form>
  );
}
