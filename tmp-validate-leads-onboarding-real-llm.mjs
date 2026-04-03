import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4201';

async function clickNext(page) {
  await page.getByRole('button', { name: 'Next' }).click();
}

async function addChip(page, value) {
  const input = page.locator('.question-card .chips-input input[type="text"]');
  await input.fill(value);
  await input.press('Enter');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

const workspaceState = await page.evaluate(async () => {
  const [statsResponse, topicsResponse] = await Promise.all([
    fetch('/api/leads/stats/overview'),
    fetch('/api/leads/topics'),
  ]);

  return {
    stats: await statsResponse.json(),
    topics: await topicsResponse.json(),
  };
});

if ((workspaceState.stats?.total ?? 0) !== 0 || (workspaceState.topics?.length ?? 0) !== 0) {
  console.log(
    JSON.stringify(
      {
        blocked: true,
        reason: 'workspace-not-empty',
        leadCount: workspaceState.stats?.total ?? null,
        topicCount: workspaceState.topics?.length ?? null,
      },
      null,
      2
    )
  );
  await browser.close();
  process.exit(0);
}

await page.goto(`${baseUrl}/onboarding`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Setup Interview');

await page.locator('input[type="text"]').fill('React modernization');
await clickNext(page);

await page.locator('select').selectOption('6-10 years');
await clickNext(page);

await addChip(page, 'React');
await addChip(page, 'Angular');
await addChip(page, 'TypeScript');
await clickNext(page);

await clickNext(page);

await page.locator('textarea').fill(
  'Healthcare SaaS product teams with legacy patient onboarding flows and compliance requirements.'
);
await clickNext(page);

await page.getByRole('button', { name: '51-200' }).click();
await page.getByRole('button', { name: '201-500' }).click();
await clickNext(page);

await addChip(page, 'Healthcare');
await addChip(page, 'SaaS');
await clickNext(page);

await addChip(page, 'Slow patient onboarding');
await addChip(page, 'Legacy frontend stack');
await clickNext(page);

await addChip(page, 'Faster onboarding conversion');
await addChip(page, 'Compliant patient dashboards');
await clickNext(page);

await page.locator('select').selectOption('$25k-$100k');
await clickNext(page);

await page.locator('select').selectOption('North America');
await clickNext(page);

await page.locator('select').selectOption('Consultative');
await clickNext(page);

await page.getByRole('button', { name: 'Email' }).click();
await page.getByRole('button', { name: 'LinkedIn' }).click();
await clickNext(page);

await page.locator('select').selectOption('Technical');
await clickNext(page);

await clickNext(page);

await page.getByRole('button', { name: 'Company hiring' }).click();
await page.getByRole('button', { name: 'New product launches' }).click();
await clickNext(page);

await addChip(page, 'WordPress agencies');

const analyzeRequest = page.waitForResponse(
  (response) =>
    response.url().includes('/api/leads/onboarding/analyze') &&
    response.request().method() === 'POST',
  { timeout: 180000 }
);

await page.getByRole('button', { name: 'Generate Topics' }).click();

const analyzeResponse = await analyzeRequest;
const analyzePayload = await analyzeResponse.json();

await page.waitForSelector('text=Review Generated Topics', { timeout: 180000 });

const topicNames = await page.locator('.topic-card h3').allTextContents();
const confidenceBadges = await page.locator('.confidence-badge').allTextContents();

console.log(
  JSON.stringify(
    {
      blocked: false,
      finalUrl: page.url(),
      analyzeStatus: analyzeResponse.status(),
      returnedTopics: Array.isArray(analyzePayload?.topics)
        ? analyzePayload.topics.length
        : null,
      visibleTopicNames: topicNames,
      confidenceBadges,
      consoleErrors,
    },
    null,
    2
  )
);

await browser.close();
