import { z } from 'zod';

import type { ActionResult } from '@knowledge/domain';

type AuthError = { message: string };
export type AuthGateway = {
  signInWithOtp(input: {
    email: string;
    options: { emailRedirectTo: string };
  }): Promise<{ error: AuthError | null }>;
  signInWithOAuth(input: {
    provider: 'google';
    options: { redirectTo: string };
  }): Promise<{ data: { url: string | null }; error: AuthError | null }>;
  exchangeCodeForSession(code: string): Promise<{ error: AuthError | null }>;
};

export const INVALID_EMAIL_MESSAGE = '请输入有效的邮箱地址。';
export const OTP_FAILURE_MESSAGE = '发送失败，请稍后重试。';
export const GOOGLE_FAILURE_MESSAGE = 'Google 登录暂时不可用，请使用邮箱登录。';

export async function requestEmailOtp(
  auth: AuthGateway,
  input: { email: string; callbackUrl: string }
): Promise<ActionResult<undefined>> {
  // A malformed address is a form state the page has to render, not a crash.
  const parsed = z.string().trim().email().safeParse(input.email);
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: INVALID_EMAIL_MESSAGE } };
  }
  const email = parsed.data.toLowerCase();
  const { error } = await auth.signInWithOtp({
    email,
    options: { emailRedirectTo: input.callbackUrl },
  });
  return error
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: OTP_FAILURE_MESSAGE } }
    : { ok: true, data: undefined };
}

export async function beginGoogleSignIn(
  auth: AuthGateway,
  input: { callbackUrl: string }
): Promise<ActionResult<{ url: string }>> {
  const { data, error } = await auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: input.callbackUrl },
  });
  return error || !data.url
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: GOOGLE_FAILURE_MESSAGE } }
    : { ok: true, data: { url: data.url } };
}
