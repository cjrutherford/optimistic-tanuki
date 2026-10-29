import { expect, test } from '@playwright/test';
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = join(
  workspaceRoot,
  '.runtime-artifacts',
  'rr09',
  'v01'
);
const evidencePath = join(evidenceDirectory, 'ot-dialog-keyboard.jsonl');
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
}

test('RR09 V01 OT report and comment dialogs are keyboard dismissible', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR09_V01_LIVE_STACK'] !== 'true',
    'Requires existing stack and retained RR09 owner account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Uses one system Chrome project'
  );
  test.setTimeout(90_000);
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
  const cards = page.locator('.post-container');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  const cardCount = await cards.count();
  let reportCardIndex = -1;
  let reportTrigger: ReturnType<typeof page.locator> | undefined;
  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const menu = card.getByRole('button', { name: '...', exact: true });
    if (!(await menu.isVisible().catch(() => false))) continue;
    await menu.click();
    const report = card.getByRole('button', {
      name: 'Report post',
      exact: true,
    });
    if (await report.isVisible().catch(() => false)) {
      reportCardIndex = index;
      reportTrigger = menu;
      await report.click();
      break;
    }
  }
  let commentTargetIndex = reportCardIndex;
  if (reportCardIndex >= 0) {
    const dialog = page.getByRole('dialog', {
      name: 'Report Post',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const focusable = dialog.locator(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const focusableCount = await focusable.count();
    await expect(focusable.first()).toBeVisible();
    await focusable.first().focus();
    let tabEscaped = false;
    for (let index = 0; index < Math.max(4, focusableCount + 2); index += 1) {
      await page.keyboard.press('Tab');
      if (
        !(await dialog.evaluate((node) =>
          node.contains(document.activeElement)
        ))
      ) {
        tabEscaped = true;
        break;
      }
    }
    let shiftTabEscaped = false;
    for (let index = 0; index < Math.max(4, focusableCount + 2); index += 1) {
      await page.keyboard.press('Shift+Tab');
      if (
        !(await dialog.evaluate((node) =>
          node.contains(document.activeElement)
        ))
      ) {
        shiftTabEscaped = true;
        break;
      }
    }
    const reportRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/.*report/i.test(new URL(request.url()).pathname)) {
        reportRequests.push(request.method());
      }
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    const reportFocusRestored = reportTrigger
      ? await reportTrigger.evaluate(
          (element) => element === document.activeElement
        )
      : false;
    record({
      type: 'report-dialog-keyboard',
      route: '/feed',
      reportableCardIndex: reportCardIndex,
      dialogVisible: true,
      focusableCount,
      tabEscaped,
      shiftTabEscaped,
      escapeClosed: true,
      focusRestored: reportFocusRestored,
      reportRequests,
    });
    expect(tabEscaped, 'Tab remains inside report dialog').toBe(false);
    expect(shiftTabEscaped, 'Shift+Tab remains inside report dialog').toBe(
      false
    );
    expect(
      reportFocusRestored,
      'Focus returns to the report menu trigger'
    ).toBe(true);
    expect(reportRequests, 'No report is submitted').toEqual([]);
  } else {
    commentTargetIndex = 0;
    record({
      type: 'report-dialog-keyboard',
      route: '/feed',
      status:
        'NOT RUN: current feed returned no non-owned post with a Report post action',
      visiblePostCount: cardCount,
    });
  }

  const commentCard = cards.nth(commentTargetIndex);
  const commentToggle = commentCard.getByRole('button', {
    name: 'Leave a Comment',
    exact: true,
  });
  if (await commentToggle.isVisible().catch(() => false)) {
    const commentRequests: string[] = [];
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname.endsWith('/api/social/comment') &&
        request.method() === 'POST'
      ) {
        commentRequests.push(request.method());
      }
    });
    await commentToggle.focus();
    await page.keyboard.press('Enter');
    const editor = commentCard.locator(
      'tiptap-editor.comment-editor [contenteditable="true"]'
    );
    await expect(editor).toBeVisible();
    await editor.focus();
    await page.keyboard.type('V01 temporary draft; not submitted.');
    const cancel = commentCard.locator('.comment-actions').getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    await cancel.focus();
    await page.keyboard.press('Enter');
    await expect(editor).toBeHidden();
    expect(commentRequests, 'No comment is submitted').toEqual([]);
    record({
      type: 'comment-editor-keyboard-cancel',
      route: '/feed',
      cardIndex: commentTargetIndex,
      openedByEnter: true,
      dismissedByEnter: true,
      commentRequests,
    });
  } else {
    record({
      type: 'comment-editor-keyboard-cancel',
      route: '/feed',
      status:
        'NOT RUN: comment affordance absent on the selected existing card',
    });
  }
});
