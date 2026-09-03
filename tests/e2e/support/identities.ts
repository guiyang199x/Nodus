import { createHash, randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export async function createIdentity(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`fixture user failed: ${email}`);
  return data.user.id;
}

/**
 * Signs in through the real form and the real emailed link.
 *
 * An admin-generated link cannot be used here: the callback exchanges a PKCE
 * code, and the verifier only exists in the browser that submitted the form.
 * Driving the form is also what an acceptance gate should be asserting.
 */
export async function signIn(page: Page, email: string) {
  const since = Date.now();
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByRole('button', { name: '发送登录链接' }).click();
  await page.getByText('登录链接已发送，请检查邮箱。').waitFor();
  await page.goto(await waitForSignInLink(email, since));
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function waitForSignInLink(email: string, since: number) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=50`).then((r) => r.json());
    const message = (list.messages ?? []).find(
      (item: { To: Array<{ Address: string }>; Created: string }) =>
        item.To?.[0]?.Address?.toLowerCase() === email.toLowerCase() &&
        new Date(item.Created).getTime() >= since - 5_000
    );
    if (message) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`).then((r) => r.json());
      const body = (detail.HTML || detail.Text || '').replaceAll('&amp;', '&');
      const link = (body.match(/https?:\/\/[^\s"'<>]+/g) ?? []).find((url: string) =>
        url.includes('/verify')
      );
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no sign-in email arrived for ${email}`);
}

/**
 * Seeds inside one transaction. The owner guard is a deferred constraint
 * trigger, so inserting a workspace and its owner membership as two separate
 * statements - which is all PostgREST can do - fails with 23514 at the first
 * commit.
 */
async function withTransaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

export async function seedFoundationFixture() {
  const suffix = randomUUID().slice(0, 8);
  const emails = {
    owner: `owner-${suffix}@example.test`,
    admin: `admin-${suffix}@example.test`,
    editor: `editor-${suffix}@example.test`,
    viewer: `viewer-${suffix}@example.test`,
    outsider: `outsider-${suffix}@example.test`,
  };
  const entries = await Promise.all(
    Object.entries(emails).map(async ([key, email]) => [key, await createIdentity(email)] as const)
  );
  const users = Object.fromEntries(entries) as Record<keyof typeof emails, string>;

  const teamOne = randomUUID();
  const teamTwo = randomUUID();
  await withTransaction(async (client) => {
    await client.query(
      `insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by)
       values ($1, 'team', 'Team One', $2, $3, $3), ($4, 'team', 'Team Two', $5, $6, $6)`,
      [teamOne, `team-one-${suffix}`, users.owner, teamTwo, `team-two-${suffix}`, users.outsider]
    );
    await client.query(
      `insert into public.memberships (workspace_id, user_id, role, status, joined_at)
       values ($1,$2,'owner','active',now()), ($1,$3,'admin','active',now()),
              ($1,$4,'editor','active',now()), ($1,$5,'viewer','active',now()),
              ($6,$7,'owner','active',now())`,
      [teamOne, users.owner, users.admin, users.editor, users.viewer, teamTwo, users.outsider]
    );
  });

  return { emails, users, teamOne, teamTwo };
}

export async function createKnownInvitation(
  workspaceId: string,
  invitedBy: string,
  email: string,
  role: 'admin' | 'editor' | 'viewer'
) {
  const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const tokenHash = `\\x${createHash('sha256').update(token).digest('hex')}`;
  const { error } = await admin.from('invitations').insert({
    workspace_id: workspaceId,
    email,
    role,
    token_hash: tokenHash,
    invited_by: invitedBy,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export { admin };
