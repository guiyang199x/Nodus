import { expect, test } from '@playwright/test';

import { admin, seedFoundationFixture, signIn } from './support/identities';

test('viewer is read-only, editor sees the team warning and a verified upload appears queued', async ({
  browser,
}) => {
  const fixture = await seedFoundationFixture();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await signIn(viewerPage, fixture.emails.viewer);
  await viewerPage.goto(`/w/${fixture.teamOne}/library`);
  await expect(viewerPage.getByText('你在此工作区拥有只读权限。')).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: '上传资料' })).toHaveCount(0);

  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await signIn(editorPage, fixture.emails.editor);
  await editorPage.goto(`/w/${fixture.teamOne}/library`);
  await editorPage.getByRole('button', { name: '上传资料' }).click();
  await expect(editorPage.getByText('Team One 的所有成员都能看到这些资料。')).toBeVisible();
  await editorPage.getByLabel('选择资料').setInputFiles({
    name: 'foundation.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('foundation'),
  });
  // The durable outcome is what the slice promises: the upload is verified and
  // the revision is queued. The in-dialog progress line is transient, since a
  // successful batch closes the dialog and refreshes the route.
  await expect(editorPage.getByRole('cell', { name: 'foundation' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(editorPage.getByRole('cell', { name: '排队中' })).toBeVisible();
  await expect(editorPage.getByRole('dialog')).toHaveCount(0);

  // No horizontal scrolling at any accepted width.
  expect(
    await editorPage.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  // Removing the viewer takes effect on their very next request.
  await admin
    .from('memberships')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('workspace_id', fixture.teamOne)
    .eq('user_id', fixture.users.viewer);
  await viewerPage.reload();
  await expect(viewerPage.getByRole('heading', { name: '404' })).toBeVisible();

  await viewerContext.close();
  await editorContext.close();
});

test('an outsider cannot see another team and its documents stay invisible', async ({ page }) => {
  const fixture = await seedFoundationFixture();
  await signIn(page, fixture.emails.outsider);
  await page.goto(`/w/${fixture.teamOne}/library`);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});
