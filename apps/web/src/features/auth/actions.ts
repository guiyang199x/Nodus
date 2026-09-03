'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { LOGIN_STATE_COPY } from './login-copy';
import type { GoogleState, LoginState } from './login-state';

import { beginGoogleSignIn, requestEmailOtp } from './service';

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function callbackUrl(next: string): string {
  const url = new URL('/auth/callback', process.env.APP_URL);
  url.searchParams.set('next', next);
  return url.toString();
}

export async function requestEmailOtpAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const client = await createServerSupabaseClient();
  const result = await requestEmailOtp(client.auth, {
    email,
    callbackUrl: callbackUrl(safeNext(formData.get('next'))),
  });
  if (result.ok) {
    return {
      status: 'sent',
      message: LOGIN_STATE_COPY.sent,
      email,
      sentAt: Date.now(),
    };
  }
  return {
    status: result.error.code === 'INVALID_INPUT' ? 'invalid' : 'error',
    message: result.error.message,
    email,
    sentAt: null,
  };
}

export async function signInWithGoogleAction(
  _state: GoogleState,
  formData: FormData
): Promise<GoogleState> {
  const client = await createServerSupabaseClient();
  const result = await beginGoogleSignIn(client.auth, {
    callbackUrl: callbackUrl(safeNext(formData.get('next'))),
  });
  // Only a failure returns state; success leaves the app for the provider.
  if (!result.ok) return { status: 'error', message: result.error.message };
  redirect(result.data.url);
}
