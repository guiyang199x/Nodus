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
