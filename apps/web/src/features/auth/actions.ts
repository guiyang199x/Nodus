'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { beginGoogleSignIn, requestEmailOtp } from './service';

export type LoginState = { status: 'idle' | 'sent' | 'error'; message: string };

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
  const client = await createServerSupabaseClient();
  const next = safeNext(formData.get('next'));
  const result = await requestEmailOtp(client.auth, {
    email: String(formData.get('email') ?? ''),
    callbackUrl: callbackUrl(next),
  });
  return result.ok
    ? { status: 'sent', message: '登录链接已发送，请检查邮箱。' }
    : { status: 'error', message: result.error.message };
}

export async function signInWithGoogleAction(formData: FormData): Promise<never> {
  const client = await createServerSupabaseClient();
  const result = await beginGoogleSignIn(client.auth, {
    callbackUrl: callbackUrl(safeNext(formData.get('next'))),
  });
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error.message)}`);
  redirect(result.data.url);
}
