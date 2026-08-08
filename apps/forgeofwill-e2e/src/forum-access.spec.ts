import { expect, test } from '@playwright/test';

test.describe('Forge forum access', () => {
  test('allows an anonymous visitor to read seeded topics', async ({
    page,
  }) => {
    const topicsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topics') &&
        response.request().method() === 'GET'
    );

    await page.goto('/forum');
    const topicsResponse = await topicsResponsePromise;
    const topics = (await topicsResponse.json()) as Array<{
      title: string;
      appScope: string;
    }>;

    expect(
      topicsResponse.ok(),
      `forum topics request failed: ${topicsResponse.status()} ${topicsResponse.url()}`
    ).toBeTruthy();
    expect(topics.map((topic) => topic.title)).toEqual(
      expect.arrayContaining([
        'Project Execution',
        'Risks, Decisions, and Lessons Learned',
      ])
    );
    expect(
      topics.every((topic) => topic.appScope === 'forgeofwill')
    ).toBeTruthy();
    expect(topics.map((topic) => topic.title)).not.toContain(
      'Community Introductions'
    );
    await expect(page).toHaveURL(/\/forum/);
    await expect(page.getByText('Project Execution')).toBeVisible();
    await expect(
      page.getByText('Risks, Decisions, and Lessons Learned')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create New Topic' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Create New Thread' })
    ).toHaveCount(0);
  });

  test('opens a seeded topic and loads its scoped thread list', async ({
    page,
  }) => {
    await page.goto('/forum');
    const topicCard = page.getByText('Project Execution', { exact: true });
    await expect(topicCard).toBeVisible();

    const threadsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topic/') &&
        response.url().endsWith('/threads') &&
        response.request().method() === 'GET'
    );
    await topicCard.click();
    const threadsResponse = await threadsResponsePromise;

    expect(threadsResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/forum\/topic\/[0-9a-f-]+$/);
    await expect(page.getByText('No threads in this topic yet.')).toBeVisible();
  });
});
