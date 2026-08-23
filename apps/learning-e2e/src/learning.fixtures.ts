import { Page } from '@playwright/test';

/**
 * Gateway responses, stubbed at the network layer.
 *
 * Shaped to match what apps/gateway actually returns, so a change to the
 * contract shows up here as a failing test rather than as a silent drift.
 */

export const GO_TRACK = {
  id: 'go-foundations',
  displayName: 'Go',
  supportedLanguageIds: ['go'],
  offerings: [
    {
      id: 'go-foundations-100-core',
      displayName: 'Go Foundations',
      modules: [
        {
          id: 'go-foundations-basics',
          title: 'Go Basics',
          lessons: [
            {
              id: 'go-foundations-basics-hello-world',
              title: 'Hello World',
              slug: 'hello-world',
            },
            {
              id: 'go-foundations-basics-variables-types',
              title: 'Variables & Types',
              slug: 'variables-types',
            },
          ],
        },
      ],
    },
  ],
};

export const DASHBOARD = [
  {
    program: GO_TRACK,
    totals: { lessons: 47, exercises: 12, points: 240 },
    progress: {
      completedLessons: 0,
      completedExercises: 0,
      points: 0,
      nextLessonId: 'go-foundations-basics-hello-world',
    },
  },
];

export const LESSON = {
  lesson: {
    id: 'go-foundations-basics-hello-world',
    title: 'Hello World',
    slug: 'hello-world',
  },
  content: [
    '# Hello World',
    '',
    'Every Go program starts in `main`.',
    '',
    '```go',
    'package main',
    '',
    'import "fmt"',
    '',
    'func main() {',
    '\tfmt.Println("Hello, Go!")',
    '}',
    '```',
    '',
    '| Type | Zero |',
    '| --- | --- |',
    '| int | 0 |',
  ].join('\n'),
  exercises: [
    {
      id: 'go-b-01',
      languageId: 'go',
      title: 'Print a greeting',
      description: 'Write a program that prints Hello, Go!',
      starterCode: 'package main\n\nfunc main() {\n}\n',
      hints: ['Import fmt', 'Use fmt.Println', 'Mind the exclamation mark'],
      points: 10,
      difficulty: 'easy',
    },
  ],
};

interface StubOptions {
  /** Lesson progress the visitor already has. Empty means anonymous. */
  progress?: unknown[];
  /** How the gateway answers a submit. Defaults to a pass. */
  submit?: { status: number; body?: unknown };
}

/** Puts the gateway behind the client, so the client can be tested alone. */
export async function stubGateway(
  page: Page,
  options: StubOptions = {}
): Promise<void> {
  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/learning/dashboard', (route) =>
    route.fulfill(json(DASHBOARD))
  );
  await page.route('**/api/learning/me/progress', (route) =>
    route.fulfill(json(options.progress ?? []))
  );
  await page.route('**/api/learning/programs/*/lessons/*', (route) =>
    route.fulfill(json(LESSON))
  );
  await page.route('**/api/learning/runs', (route) =>
    route.fulfill(json({ output: 'Hello, Go!\n', errors: [] }))
  );
  await page.route('**/api/learning/exercises/*/submit', (route) => {
    const submit = options.submit ?? {
      status: 200,
      body: {
        output: 'Hello, Go!\n',
        errors: [],
        passed: true,
        awardedPoints: 10,
        progress: {
          lessonId: 'go-foundations-basics-hello-world',
          completed: false,
          completedExerciseIds: ['go-b-01'],
          points: 10,
        },
      },
    };
    return route.fulfill({
      status: submit.status,
      contentType: 'application/json',
      body: JSON.stringify(submit.body ?? {}),
    });
  });
}

export const LESSON_URL =
  '/module/go-foundations/go-foundations-basics/go-foundations-basics-hello-world';
