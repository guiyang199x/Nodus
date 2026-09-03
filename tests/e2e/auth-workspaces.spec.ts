import { expect, test } from '@playwright/test';

import {
  createIdentity,
  createKnownInvitation,
  seedFoundationFixture,
  signIn,
} from './support/identities';

test('email login lands in the private personal library and an accepted invitation becomes the landing workspace', async ({
  page,
}) => {
  const fixture = await seedFoundationFixture();
  const inviteeEmail = `invitee-${Date.now()}@example.test`;
  await createIdentity(inviteeEmail);

  await signIn(page, inviteeEmail);
  // A brand new account gets exactly one private personal workspace.
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}\/library/);
  await expect(page.getByRole('heading', { name: '放入第一份资料' })).toBeVisible();
  const personalUrl = page.url();

  const token = await createKnownInvitation(
    fixture.teamOne,
    fixture.users.owner,
    inviteeEmail,
    'viewer'
  );
  await page.goto(`/invite/${token}`);
  await page.getByRole('button', { name: '接受邀请' }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${fixture.teamOne}/library`));

  // The entry resolver now sends this account to the team it just joined.
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/w/${fixture.teamOne}/library`));
  expect(personalUrl).not.toContain(fixture.teamOne);

  // A single-use token cannot be redeemed twice.
  await page.goto(`/invite/${token}`);
  await page.getByRole('button', { name: '接受邀请' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('an unauthenticated visitor cannot reach a workspace and is not told whether it exists', async ({
  page,
}) => {
  const fixture = await seedFoundationFixture();
  await page.goto(`/w/${fixture.teamOne}/library`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: '让知识重新连接' })).toBeVisible();
});
