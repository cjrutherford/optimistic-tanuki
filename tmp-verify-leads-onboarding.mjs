import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4201';

async function runScenario(name, handlers, assertion) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const seenRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[${name}] console error: ${msg.text()}`);
    }
  });

  await page.route('**/api/leads/**', async (route) => {
    const url = route.request().url();
    seenRequests.push(url);

    for (const handler of handlers) {
      if (handler.match(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(handler.body),
        });
        return;
      }
    }

    await route.continue();
  });

  const result = await assertion(page);
  result.requests = seenRequests;

  await browser.close();
  return result;
}

const emptyWorkspaceHandlers = [
  {
    match: (url) => url.endsWith('/api/leads/stats/overview'),
    body: {
      total: 0,
      autoDiscovered: 0,
      manual: 0,
      totalValue: 0,
      followUpsDue: 0,
      byStatus: {},
    },
  },
  {
    match: (url) => url.endsWith('/api/leads/topics'),
    body: [],
  },
];

const configuredWorkspaceHandlers = [
  {
    match: (url) => url.endsWith('/api/leads/stats/overview'),
    body: {
      total: 3,
      autoDiscovered: 1,
      manual: 2,
      totalValue: 9000,
      followUpsDue: 1,
      byStatus: { new: 2, won: 1 },
    },
  },
  {
    match: (url) => url.endsWith('/api/leads/topics'),
    body: [
      {
        id: 'topic-1',
        name: 'React opportunities',
        description: 'React work',
        keywords: ['react'],
        excludedTerms: [],
        enabled: true,
        leadCount: 0,
      },
    ],
  },
];

const results = [];

results.push(
  await runScenario(
    'empty workspace redirects to onboarding',
    emptyWorkspaceHandlers,
    async (page) => {
      await page.goto(`${baseUrl}/topics`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/onboarding');
      await page.waitForSelector('text=Setup Interview');

      return {
        url: page.url(),
        setupInterviewVisible: await page.locator('text=Setup Interview').isVisible(),
        primaryNavVisible: await page.locator('.nav-links').count(),
      };
    }
  )
);

results.push(
  await runScenario(
    'configured workspace leaves onboarding',
    configuredWorkspaceHandlers,
    async (page) => {
      await page.goto(`${baseUrl}/onboarding`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(`${baseUrl}/`);
      await page.waitForSelector('text=Lead Command');

      return {
        url: page.url(),
        dashboardVisible: await page.locator('text=Pipeline Overview').isVisible(),
        primaryNavVisible: await page.locator('.nav-links').isVisible(),
      };
    }
  )
);

console.log(JSON.stringify(results, null, 2));
