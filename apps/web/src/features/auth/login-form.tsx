'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { requestEmailOtpAction } from './actions';
import { LOGIN_COPY, LOGIN_STATE_COPY, RESEND_DELAY_MS } from './login-copy';
import { initialLoginState } from './login-state';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestEmailOtpAction, initialLoginState);
  const emailRef = useRef<HTMLInputElement>(null);
  const [canResend, setCanResend] = useState(false);

  // A rejected address keeps what was typed and returns focus to the field.
  // The call is deferred because React settles the form after an action
  // resolves and would otherwise take the focus straight back. A timer is used
  // rather than requestAnimationFrame, which browsers throttle to a standstill
  // while the tab is in the background.
  useEffect(() => {
    if (state.status !== 'invalid') return;
    const timer = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [state]);

  // The confirmation stays static for 30 seconds before offering a retry.
  useEffect(() => {
    if (state.status !== 'sent' || state.sentAt === null) {
      setCanResend(false);
      return;
    }
    setCanResend(false);
    const timer = setTimeout(() => setCanResend(true), RESEND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.status, state.sentAt]);

  const invalid = state.status === 'invalid';
  const sent = state.status === 'sent';
  const failed = state.status === 'error';

  return (
    <form action={action} noValidate className="w-full">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="email" className="block text-[13px] font-medium text-[var(--ink)]">
        {LOGIN_COPY.emailLabel}
      </label>
      <input
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={LOGIN_COPY.emailPlaceholder}
        defaultValue={state.email}
        required
        aria-invalid={invalid || undefined}
        aria-describedby="login-status"
        className="mt-2 h-[var(--control-height)] w-full rounded-[var(--radius-control)] border bg-white px-4 text-[15px] text-[var(--ink)] transition-colors duration-150 placeholder:text-[#A5A49F] focus:outline-2 focus:outline-offset-0"
        style={{
          borderColor: invalid ? 'var(--danger)' : 'var(--line)',
          outlineColor: invalid ? 'var(--danger)' : 'var(--accent)',
        }}
      />

      <button
        type="submit"
        disabled={pending || (sent && !canResend)}
        className="mt-4 h-[var(--control-height)] w-full rounded-[var(--radius-control)] bg-[var(--accent)] text-[15px] font-medium text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[var(--accent-strong)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-default disabled:bg-[#8FA9E4] disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0"
      >
        {pending
          ? LOGIN_STATE_COPY.sending
          : sent
            ? canResend
              ? LOGIN_STATE_COPY.resend
              : LOGIN_STATE_COPY.sentButton
            : LOGIN_COPY.primaryAction}
      </button>

      <p
        id="login-status"
        aria-live="polite"
        className="mt-2 min-h-5 text-[13px] leading-5"
        style={{ color: invalid || failed ? 'var(--danger)' : 'var(--muted)' }}
      >
        {state.message}
      </p>
    </form>
  );
}
