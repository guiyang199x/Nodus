'use client';

import { useActionState } from 'react';

import { signInWithGoogleAction } from './actions';
import { LOGIN_COPY, LOGIN_STATE_COPY } from './login-copy';
import { initialGoogleState } from './login-state';
import { GoogleMark } from './google-mark';

export function GoogleSignInButton({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithGoogleAction, initialGoogleState);
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending}
        aria-describedby="google-status"
        className="flex h-[var(--control-height)] w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-white text-[15px] font-medium text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        <GoogleMark />
        {pending ? LOGIN_STATE_COPY.googlePending : LOGIN_COPY.secondaryAction}
      </button>
      <p
        id="google-status"
        aria-live="polite"
        className="mt-2 text-[13px] leading-5 text-[var(--danger)] empty:mt-0"
      >
        {state.status === 'error' ? state.message : ''}
      </p>
    </form>
  );
}
