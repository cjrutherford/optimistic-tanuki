import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const origin = new URL(process.env['BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};

const ownerCredentialsPath =
  process.env['RR10_I02_OWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const readerCredentialsPath =
  process.env['RR10_I02_READER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';

async function loginConfiguredOwner(
  page: Page
): Promise<{ profileId: string; userId: string }> {
  const credentials = JSON.parse(
    readFileSync(ownerCredentialsPath, 'utf8')
  ) as {
    email?: unknown;
    password?: unknown;
  };
  expect(typeof credentials.email).toBe('string');
  expect(typeof credentials.password).toBe('string');
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page
    .getByLabel('Email', { exact: true })
    .fill(credentials.email as string);
  await page
    .getByLabel('Password', { exact: true })
    .fill(credentials.password as string);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const session = await page.request.get(
    `${origin}/api/authentication/session`,
    {
      headers,
    }
  );
  expect(session.status(), 'configured owner session').toBe(200);
  const body = (await session.json()) as {
    data?: { profileId?: unknown; userId?: unknown };
  };
  expect(typeof body.data?.profileId).toBe('string');
  expect(typeof body.data?.userId).toBe('string');
  return {
    profileId: body.data!.profileId as string,
    userId: body.data!.userId as string,
  };
}

async function loginForumReader(
  page: Page
): Promise<{ profileId: string; userId: string }> {
  const credentials = JSON.parse(
    readFileSync(readerCredentialsPath, 'utf8')
  ) as { email?: unknown; password?: unknown };
  expect(typeof credentials.email).toBe('string');
  expect(typeof credentials.password).toBe('string');
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page
    .getByLabel('Email', { exact: true })
    .fill(credentials.email as string);
  await page
    .getByLabel('Password', { exact: true })
    .fill(credentials.password as string);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const session = await page.request.get(
    `${origin}/api/authentication/session`,
    {
      headers,
    }
  );
  expect(session.status(), 'saved forum-reader session').toBe(200);
  const sessionBody = (await session.json()) as {
    data?: { profileId?: unknown; userId?: unknown };
  };
  expect(typeof sessionBody.data?.profileId).toBe('string');
  expect(typeof sessionBody.data?.userId).toBe('string');
  const rolesResponse = await page.request.get(
    `${origin}/api/permissions/user-roles/${
      sessionBody.data!.profileId
    }?appScope=client-interface`,
    { headers }
  );
  const roles = await responseJson<Array<{ role?: { name?: string } }>>(
    rolesResponse
  );
  expect(
    roles.some((assignment) => assignment.role?.name === 'forum_user'),
    'saved non-owner fixture must have the ordinary forum_user role'
  ).toBe(true);
  return {
    profileId: sessionBody.data!.profileId as string,
    userId: sessionBody.data!.userId as string,
  };
}

async function responseJson<T>(
  response: Awaited<ReturnType<Page['request']['get']>>
): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} returned ${response.status()}`
  ).toBeTruthy();
  return (await response.json()) as T;
}

test.describe('RR10 I02 forum deletion UI', () => {
  test.setTimeout(180_000);
  test.describe.configure({ retries: 0 });

  test('hides delete from a non-owner and lets the author delete only after confirmation', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(
      process.env['RR10_I02_LIVE_STACK'] !== 'true',
      'Requires the existing client-interface Docker stack'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Run the authenticated destructive fixture once in desktop Chrome'
    );

    const author = await loginConfiguredOwner(page);
    let topic: { id: string; title: string; profileId: string } | null = null;
    let thread: {
      id: string;
      title: string;
      profileId: string;
      topicId: string;
    } | null = null;
    let threadDeleted = false;
    let topicDeleted = false;
    let outsiderContext: Awaited<ReturnType<typeof browser.newContext>> | null =
      null;

    try {
      outsiderContext = await browser.newContext();
      const outsiderPage = await outsiderContext.newPage();
      const reader = await loginForumReader(outsiderPage);
      expect(reader.profileId).not.toBe(author.profileId);

      const createdTopic = await page.request.post(
        `${origin}/api/forum/topic`,
        {
          headers,
          data: {
            title: `RR10 I02 empty parent ${randomUUID().slice(0, 8)}`,
            description: 'Disposable empty parent for the I02 browser proof.',
            profileId: author.profileId,
          },
        }
      );
      expect(createdTopic.status()).toBe(201);
      topic = await createdTopic.json();
      expect(topic!.id).toEqual(expect.any(String));
      expect(topic!.profileId).toBe(author.profileId);

      const createdThread = await page.request.post(
        `${origin}/api/forum/thread`,
        {
          headers,
          data: {
            title: `RR10 I02 empty child ${randomUUID().slice(0, 8)}`,
            description: 'Disposable empty thread for the I02 browser proof.',
            content: 'Disposable empty thread body for the I02 browser proof.',
            profileId: author.profileId,
            topicId: topic!.id,
          },
        }
      );
      expect(createdThread.status()).toBe(201);
      thread = await createdThread.json();
      expect(thread!.id).toEqual(expect.any(String));
      expect(thread!.profileId).toBe(topic!.profileId);

      const ensureEmpty = async () => {
        const topicsThreads = await page.request.get(
          `${origin}/api/forum/topic/${topic!.id}/threads`,
          { headers }
        );
        expect(await responseJson<unknown[]>(topicsThreads)).toHaveLength(
          threadDeleted ? 0 : 1
        );
        if (!threadDeleted) {
          const posts = await page.request.get(
            `${origin}/api/forum/thread/${thread!.id}/posts`,
            { headers }
          );
          expect(await responseJson<unknown[]>(posts)).toHaveLength(0);
        }
      };

      await outsiderPage.goto(`${origin}/forum/thread/${thread!.id}`);
      await expect(
        outsiderPage.getByRole('heading', {
          name: thread!.title,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        outsiderPage.getByRole('button', { name: 'Delete thread' })
      ).toHaveCount(0);
      const outsiderDelete = await outsiderPage.request.delete(
        `${origin}/api/forum/thread/${thread!.id}`,
        { headers }
      );
      expect(outsiderDelete.status()).toBe(403);
      expect(
        (
          await responseJson<{ id: string }>(
            await outsiderPage.request.get(
              `${origin}/api/forum/thread/${thread!.id}`,
              { headers }
            )
          )
        ).id
      ).toBe(thread!.id);

      await ensureEmpty();
      await page.goto(`${origin}/forum/topic/${topic!.id}`);
      await expect(
        page.getByRole('heading', { name: topic!.title, exact: true })
      ).toBeVisible();
      const protectedTopicDelete = page.getByRole('button', {
        name: 'Delete topic',
      });
      await expect(protectedTopicDelete).toBeVisible();
      await protectedTopicDelete.click();
      const protectedTopicDialog = page.locator('.forum-delete-confirmation');
      const conflictResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/forum/topic/${topic!.id}` &&
          response.request().method() === 'DELETE'
      );
      await protectedTopicDialog
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      const conflictResponse = await conflictResponsePromise;
      expect(conflictResponse.status()).toBe(409);
      await expect(protectedTopicDialog).toContainText(
        'This item still has threads or posts'
      );
      await expect(page).toHaveURL(new RegExp(`/forum/topic/${topic!.id}$`));
      expect(
        (
          await responseJson<{ id: string }>(
            await page.request.get(`${origin}/api/forum/topic/${topic!.id}`, {
              headers: headers,
            })
          )
        ).id
      ).toBe(topic!.id);
      expect(
        (
          await responseJson<{ id: string }>(
            await page.request.get(`${origin}/api/forum/thread/${thread!.id}`, {
              headers: headers,
            })
          )
        ).id
      ).toBe(thread!.id);
      await protectedTopicDialog
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();

      await page.goto(`${origin}/forum/thread/${thread!.id}`);
      await expect(
        page.getByRole('heading', { name: thread!.title, exact: true })
      ).toBeVisible();
      const deleteThread = page.getByRole('button', { name: 'Delete thread' });
      await expect(deleteThread).toBeVisible();
      await deleteThread.click();
      const threadDialog = page.locator('.forum-delete-confirmation');
      await expect(threadDialog).toContainText('no posts');
      const threadDeleteRequest = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/forum/thread/${thread!.id}` &&
          response.request().method() === 'DELETE'
      );
      await threadDialog
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      expect((await threadDeleteRequest).status()).toBe(200);
      const missingThread = await page.request.get(
        `${origin}/api/forum/thread/${thread!.id}`,
        { headers: headers }
      );
      expect(missingThread.status()).toBe(404);
      threadDeleted = true;
      await expect(page).toHaveURL(new RegExp(`/forum/topic/${topic!.id}$`));

      await ensureEmpty();
      const deleteTopic = page.getByRole('button', { name: 'Delete topic' });
      await expect(deleteTopic).toBeVisible();
      await deleteTopic.click();
      const topicDialog = page.locator('.forum-delete-confirmation');
      await expect(topicDialog).toContainText('no threads');
      const topicDeleteRequest = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/forum/topic/${topic!.id}` &&
          response.request().method() === 'DELETE'
      );
      await topicDialog
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      expect((await topicDeleteRequest).status()).toBe(200);
      const missingTopic = await page.request.get(
        `${origin}/api/forum/topic/${topic!.id}`,
        { headers: headers }
      );
      expect(missingTopic.status()).toBe(404);
      topicDeleted = true;
      await expect(page).toHaveURL(/\/forum$/);
    } finally {
      // Delete only the exact empty fixtures created in this test. Never cascade.
      if (thread && !threadDeleted) {
        const threadGet = await page.request.get(
          `${origin}/api/forum/thread/${thread.id}`,
          { headers }
        );
        if (threadGet.ok()) {
          const posts = await page.request.get(
            `${origin}/api/forum/thread/${thread.id}/posts`,
            { headers }
          );
          if (posts.ok() && ((await posts.json()) as unknown[]).length === 0) {
            await page.request.delete(
              `${origin}/api/forum/thread/${thread.id}`,
              {
                headers,
              }
            );
          }
        }
      }
      if (topic) {
        if (!topicDeleted) {
          const topicThreads = await page.request.get(
            `${origin}/api/forum/topic/${topic.id}/threads`,
            { headers }
          );
          if (
            topicThreads.ok() &&
            ((await topicThreads.json()) as unknown[]).length === 0
          ) {
            await page.request.delete(`${origin}/api/forum/topic/${topic.id}`, {
              headers,
            });
          }
        }
        const topicReadback = await page.request.get(
          `${origin}/api/forum/topic/${topic.id}`,
          { headers }
        );
        expect([404, 410]).toContain(topicReadback.status());
      }
      if (thread) {
        const threadReadback = await page.request.get(
          `${origin}/api/forum/thread/${thread.id}`,
          { headers }
        );
        expect([404, 410]).toContain(threadReadback.status());
      }
      await outsiderContext?.close();
    }
  });
});
