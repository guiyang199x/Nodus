import { describe, expect, it } from 'vitest';

import {
  GOOGLE_FAILURE_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  OTP_FAILURE_MESSAGE,
} from './service';
import { LOGIN_COPY, LOGIN_STATE_COPY, RESEND_DELAY_MS } from './login-copy';

// The login page copy is fixed by an approved design spec. These assertions
// exist so a future edit cannot quietly drift away from it.
describe('approved login copy', () => {
  it('matches the spec strings verbatim', () => {
    expect(LOGIN_COPY).toEqual({
      productName: '知识工作台',
      headline: '让知识重新连接',
      description: '登录后继续整理、发现与提问。',
      emailLabel: '邮箱',
      emailPlaceholder: 'name@company.com',
      primaryAction: '发送登录链接',
      secondaryAction: '使用 Google 登录',
      divider: '或',
      privacyPrefix: '登录即表示你同意我们的',
      termsLink: '服务条款',
      privacyConjunction: '和',
      privacyLink: '隐私政策',
      privacySuffix: '。',
    });
  });

  it('composes the privacy sentence the spec specifies', () => {
    const sentence =
      LOGIN_COPY.privacyPrefix +
      LOGIN_COPY.termsLink +
      LOGIN_COPY.privacyConjunction +
      LOGIN_COPY.privacyLink +
      LOGIN_COPY.privacySuffix;
    expect(sentence).toBe('登录即表示你同意我们的服务条款和隐私政策。');
  });

  it('keeps the service messages and the rendered state copy in agreement', () => {
    expect(LOGIN_STATE_COPY.invalidEmail).toBe(INVALID_EMAIL_MESSAGE);
    expect(LOGIN_STATE_COPY.sendFailed).toBe(OTP_FAILURE_MESSAGE);
    expect(LOGIN_STATE_COPY.googleFailed).toBe(GOOGLE_FAILURE_MESSAGE);
  });

  it('offers resend after the 30 second delay the spec requires', () => {
    expect(RESEND_DELAY_MS).toBe(30_000);
  });
});
