/**
 * Fixed copy from docs/superpowers/specs/2026-09-02-login-page-design.md.
 * The spec calls these strings fixed content, so they live in one place and are
 * asserted verbatim in login-copy.test.ts rather than being retyped in JSX.
 */
export const LOGIN_COPY = {
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
} as const;

/** Form state copy, spec section 8. */
export const LOGIN_STATE_COPY = {
  sending: '正在发送…',
  sent: '登录链接已发送，请检查邮箱。',
  sentButton: '已发送',
  resend: '重新发送',
  invalidEmail: '请输入有效的邮箱地址。',
  sendFailed: '发送失败，请稍后重试。',
  googlePending: '正在跳转…',
  googleFailed: 'Google 登录暂时不可用，请使用邮箱登录。',
} as const;

export const RESEND_DELAY_MS = 30_000;
