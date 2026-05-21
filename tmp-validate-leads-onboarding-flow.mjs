import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4201';

const reviewedTopics = [
  {
    name: 'React modernization roles',
    description: 'Remote and hybrid positions for React modernization specialists.',
    keywords: ['react modernization', 'angular migration', 'frontend architecture'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'job-openings',
    sources: ['remoteok', 'himalayas', 'indeed'],
    priority: 1,
    targetCompanies: ['B2B SaaS companies'],
    buyerPersona: '',
    painPoints: ['legacy frontend stack'],
    valueProposition: 'Modernize product UI delivery',
    searchStrategy: 'balanced',
    confidence: 91,
  },
  {
    name: 'Healthcare product teams',
    description: 'Healthcare teams likely to buy frontend modernization help.',
    keywords: ['healthcare saas', 'patient onboarding', 'dashboard rebuild'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'service-buyers',
    sources: ['google-maps', 'clutch'],
    priority: 2,
    targetCompanies: ['Healthcare SaaS teams'],
    buyerPersona: 'VP Product',
    painPoints: ['slow patient onboarding'],
    valueProposition: 'Ship compliant patient experiences faster',
    searchStrategy: 'conservative',
    confidence: 84,
  },
];

let createdTopics = [];
let analyzeRequestBody = null;
let confirmRequestBody = null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.error(`console error: ${msg.text()}`);
  }
});

await page.route('**/api/leads/**', async (route) => {
  const request = route.request();
  const url = request.url();

  if (url.endsWith('/api/leads/stats/overview')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 0,
        autoDiscovered: 0,
        manual: 0,
        totalValue: 0,
        followUpsDue: 0,
        byStatus: {},
      }),
    });
    return;
  }

  if (url.endsWith('/api/leads/topics')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createdTopics),
    });
    return;
  }

  if (url.endsWith('/api/leads/onboarding/analyze')) {
    analyzeRequestBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topics: reviewedTopics }),
    });
    return;
  }

  if (url.endsWith('/api/leads/onboarding/confirm')) {
    confirmRequestBody = request.postDataJSON();
    createdTopics = reviewedTopics.map((topic, index) => ({
      id: `topic-${index + 1}`,
      name: topic.name,
      description: topic.description,
      keywords: topic.keywords,
      excludedTerms: topic.excludedTerms,
      discoveryIntent: topic.discoveryIntent,
      sources: topic.sources,
      enabled: true,
      leadCount: 0,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topics: createdTopics }),
    });
    return;
  }

  await route.continue();
});

async function clickNext() {
  await page.getByRole('button', { name: 'Next' }).click();
}

async function addChip(value) {
  const input = page.locator('.question-card .chips-input input[type="text"]');
  await input.fill(value);
  await input.press('Enter');
}

await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
await page.waitForURL('**/onboarding');
await page.waitForSelector('text=Setup Interview');

await page.locator('input[type="text"]').fill('React modernization');
await clickNext();

await page.locator('select').selectOption('6-10 years');
await clickNext();

await addChip('React');
await addChip('Angular');
await addChip('TypeScript');
await clickNext();

await clickNext();

await page.locator('textarea').fill(
  'Healthcare SaaS product teams with legacy patient onboarding flows and compliance needs.'
);
await clickNext();

await page.getByRole('button', { name: '51-200' }).click();
await page.getByRole('button', { name: '201-500' }).click();
await clickNext();

await addChip('Healthcare');
await addChip('SaaS');
await clickNext();

await addChip('Legacy frontend performance');
await addChip('Slow patient onboarding');
await clickNext();

await addChip('Faster onboarding conversion');
await addChip('Compliant patient dashboards');
await clickNext();

await page.locator('select').selectOption('$25k-$100k');
await clickNext();

await page.locator('select').selectOption('North America');
await clickNext();

await page.locator('select').selectOption('Consultative');
await clickNext();

await page.getByRole('button', { name: 'Email' }).click();
await page.getByRole('button', { name: 'LinkedIn' }).click();
await clickNext();

await page.locator('select').selectOption('Technical');
await clickNext();

await clickNext();

await page.getByRole('button', { name: 'Company hiring' }).click();
await page.getByRole('button', { name: 'New product launches' }).click();
await clickNext();

await addChip('WordPress agencies');
await page.getByRole('button', { name: 'Generate Topics' }).click();

await page.waitForSelector('text=Review Generated Topics');
await page.waitForSelector('text=React modernization roles');
await page.waitForSelector('text=Healthcare product teams');
await page.getByRole('button', { name: 'Confirm & Create Topics' }).click();

await page.waitForURL(`${baseUrl}/topics`);
await page.waitForSelector('text=Discovery Topics');
await page.waitForSelector('text=React modernization roles');
await page.waitForSelector('text=Healthcare product teams');

const result = {
  finalUrl: page.url(),
  reviewVisible: await page.locator('text=Review Generated Topics').count(),
  analyzeProfileSummary: {
    serviceOffer: analyzeRequestBody?.serviceOffer,
    yearsExperience: analyzeRequestBody?.yearsExperience,
    skills: analyzeRequestBody?.skills,
    idealCustomer: analyzeRequestBody?.idealCustomer,
    leadSignalTypes: analyzeRequestBody?.leadSignalTypes,
  },
  confirmTopicsCount: confirmRequestBody?.topics?.length ?? 0,
  visibleTopics: await page.locator('.topic-name').allTextContents(),
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
