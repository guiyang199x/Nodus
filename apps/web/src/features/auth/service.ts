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

export async function requestEmailOtp(
  auth: AuthGateway,
  input: { email: string; callbackUrl: string }
): Promise<ActionResult<undefined>> {
  const email = z.string().email().parse(input.email).toLowerCase();
  const { error } = await auth.signInWithOtp({
    email,
    options: { emailRedirectTo: input.callbackUrl },
  });
  return error
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: '验证码邮件发送失败，请稍后重试' } }
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
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: 'Google 登录暂时不可用' } }
    : { ok: true, data: { url: data.url } };
}
