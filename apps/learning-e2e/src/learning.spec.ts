import { expect, test } from '@playwright/test';
import { LESSON_URL, stubGateway } from './learning.fixtures';

test.describe('Learning Studio', () => {
  test.beforeEach(async ({ page }) => {
    await stubGateway(page);
  });

  test('the landing page invites a learner in', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /dashboard|start|begin/i }).first()
    ).toBeVisible();
  });

  test('the dashboard lists the tracks and what they contain', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Go', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('47 lessons')).toBeVisible();
  });

  test('a module page lists its lessons in order', async ({ page }) => {
    await page.goto('/module/go-foundations/go-foundations-basics');

    await expect(page.getByRole('link', { name: /Hello World/ })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Variables & Types/ })
    ).toBeVisible();
  });

  test.describe('a lesson', () => {
    test('renders markdown rather than showing its source', async ({
      page,
    }) => {
      await page.goto(LESSON_URL);

      // A heading element, not a literal '#'.
      await expect(
        page.getByRole('heading', { name: 'Hello World', level: 1 })
      ).toBeVisible();
      await expect(page.locator('.prose table')).toBeVisible();
      await expect(page.locator('.prose')).not.toContainText('```');
    });

    test('highlights the code in a fenced block', async ({ page }) => {
      await page.goto(LESSON_URL);

      await expect(
        page.locator('.prose pre code.language-go').first()
      ).toBeVisible();
      await expect(page.locator('.prose .token.keyword').first()).toBeVisible();
    });

    test('offers an editor holding the starter code', async ({ page }) => {
      await page.goto(LESSON_URL);

      const editor = page.locator('learning-code-editor');
      await expect(editor).toBeVisible();
      // Monaco replaces the textarea once it loads; either satisfies this.
      await expect(editor.locator('.monaco, textarea').first()).toBeVisible();
    });

    test('runs code and shows the output', async ({ page }) => {
      await page.goto(LESSON_URL);

      await page.getByRole('button', { name: 'Run' }).click();

      await expect(page.locator('.result')).toContainText('Hello, Go!');
    });

    test('records a pass and says what it awarded', async ({ page }) => {
      await page.goto(LESSON_URL);

      await page.getByRole('button', { name: 'Submit' }).click();

      await expect(page.locator('.result.pass')).toBeVisible();
      await expect(page.locator('.result')).toContainText('Passed');
      await expect(page.locator('.result')).toContainText('10');
    });

    test('gives hints away one at a time, not all at once', async ({
      page,
    }) => {
      await page.goto(LESSON_URL);

      const hints = page.locator('.hints p');
      await expect(hints).toHaveCount(0);

      await page.getByRole('button', { name: /Show a hint/i }).click();
      await expect(hints).toHaveCount(1);

      await page.getByRole('button', { name: /Show another hint/i }).click();
      await expect(hints).toHaveCount(2);
    });
  });

  test('asks an anonymous learner to sign in rather than failing', async ({
    page,
  }) => {
    await stubGateway(page, { submit: { status: 401 } });
    await page.goto(LESSON_URL);

    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.locator('.result')).toContainText(/sign in/i);
  });

  test('shows a solved exercise as solved', async ({ page }) => {
    await stubGateway(page, {
      progress: [
        {
          lessonId: 'go-foundations-basics-hello-world',
          completed: false,
          completedExerciseIds: ['go-b-01'],
          points: 10,
        },
      ],
    });
    await page.goto(LESSON_URL);

    await expect(page.getByText('Solved')).toBeVisible();
    await expect(page.locator('.practice-head')).toContainText('1/1');
  });

  test('reports nothing to the console on a normal visit', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));

    await page.goto(LESSON_URL);
    await page.waitForLoadState('networkidle');

    expect(problems).toEqual([]);
  });
});
