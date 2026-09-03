import { describe, expect, it, vi } from 'vitest';

import { beginGoogleSignIn, requestEmailOtp, type AuthGateway } from './service';

describe('auth service', () => {
  it('sends email OTP to the callback and starts Google without persisting provider state', async () => {
    const auth: AuthGateway = {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi
        .fn()
        .mockResolvedValue({ data: { url: 'https://accounts.google.test/oauth' }, error: null }),
      exchangeCodeForSession: vi.fn(),
    };
    await expect(
      requestEmailOtp(auth, {
        email: 'person@example.test',
        callbackUrl: 'https://app.example.test/auth/callback',
      })
    ).resolves.toEqual({ ok: true, data: undefined });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      options: { emailRedirectTo: 'https://app.example.test/auth/callback' },
    });
    await expect(
      beginGoogleSignIn(auth, {
        callbackUrl: 'https://app.example.test/auth/callback',
      })
    ).resolves.toEqual({ ok: true, data: { url: 'https://accounts.google.test/oauth' } });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.example.test/auth/callback' },
    });
  });
});

describe('auth service input validation', () => {
  it('returns a renderable form error instead of throwing on a malformed address', async () => {
    const auth: AuthGateway = {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    };
    await expect(
      requestEmailOtp(auth, { email: 'not-an-email', callbackUrl: 'https://app.test/auth/callback' })
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: '请输入有效的邮箱地址。' },
    });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('reports a provider failure without leaking provider detail', async () => {
    const auth: AuthGateway = {
      signInWithOtp: vi.fn().mockResolvedValue({ error: { message: 'smtp 550 blocked' } }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: null }, error: null }),
      exchangeCodeForSession: vi.fn(),
    };
    const otp = await requestEmailOtp(auth, {
      email: 'person@example.test',
      callbackUrl: 'https://app.test/auth/callback',
    });
    expect(otp).toEqual({
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: '发送失败，请稍后重试。' },
    });
    await expect(
      beginGoogleSignIn(auth, { callbackUrl: 'https://app.test/auth/callback' })
    ).resolves.toEqual({
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: 'Google 登录暂时不可用，请使用邮箱登录。' },
    });
  });
});
