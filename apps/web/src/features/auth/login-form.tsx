'use client';

import { useActionState } from 'react';

import { requestEmailOtpAction, signInWithGoogleAction, type LoginState } from './actions';

const initialState: LoginState = { status: 'idle', message: '' };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestEmailOtpAction, initialState);
  return (
    <div className="w-full max-w-sm">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium" htmlFor="email">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-11 w-full rounded-[6px] border border-[var(--line)] px-3"
        />
        <button
          disabled={pending}
          className="min-h-11 w-full rounded-[6px] bg-[var(--accent)] px-4 text-white"
        >
          {pending ? '正在发送' : '发送登录链接'}
        </button>
        <p
          aria-live="polite"
          className={
            state.status === 'error' ? 'text-sm text-red-700' : 'text-sm text-[var(--muted)]'
          }
        >
          {state.message}
        </p>
      </form>
      <div className="my-5 border-t border-[var(--line)]" />
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next} />
        <button className="min-h-11 w-full rounded-[6px] border border-[var(--line)] px-4">
          使用 Google 登录
        </button>
      </form>
    </div>
  );
}
