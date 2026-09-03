#!/usr/bin/env node
/**
 * Prints the most recent local sign-in link.
 *
 * Local development sends auth email to Mailpit instead of a real inbox, so
 * the magic link has to be read back out of it. This only reads the local mail
 * catcher; it cannot create a session on its own, because the link carries a
 * PKCE token that is only valid for the browser that submitted the form.
 *
 * Usage:
 *   1. Submit the login form at http://127.0.0.1:3000/login
 *   2. node scripts/dev-login-link.mjs
 *   3. Open the printed URL in the same browser
 */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

async function main() {
  let list;
  try {
    const response = await fetch(`${MAILPIT}/api/v1/messages?limit=1`);
    if (!response.ok) throw new Error(`Mailpit responded ${response.status}`);
    list = await response.json();
  } catch (error) {
    console.error(`无法连接本地邮件服务 ${MAILPIT}`);
    console.error(`原因: ${error.message}`);
    console.error('请先运行 pnpm db:start');
    process.exit(1);
  }

  const [latest] = list.messages ?? [];
  if (!latest) {
    console.error('本地邮箱是空的。请先在 http://127.0.0.1:3000/login 提交一次邮箱登录。');
    process.exit(1);
  }

  const detail = await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`).then((r) => r.json());
  const body = (detail.HTML || detail.Text || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#43;', '+');
  const link = (body.match(/https?:\/\/[^\s"'<>]+/g) ?? []).find((url) => url.includes('/verify'));

  if (!link) {
    console.error('最新一封邮件里没有登录链接。');
    process.exit(1);
  }

  const to = latest.To?.[0]?.Address ?? '(unknown)';
  const age = Math.round((Date.now() - new Date(latest.Created).getTime()) / 1000);
  console.log(`收件人: ${to}   ${age} 秒前`);
  console.log('在提交表单的那个浏览器里打开:\n');
  console.log(link);
}

main();
