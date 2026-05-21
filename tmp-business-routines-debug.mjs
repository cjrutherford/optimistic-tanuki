import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:8094';
const OWNER_EMAIL = 'owner@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';
const CLIENT_EMAIL = 'client@localbusiness.test';
const CLIENT_PASSWORD = 'ClientPass123!';

async function login(page, path, email, password) {
  await page.goto(`${BASE_URL}${path}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async (response) => {
  if (!response.url().includes('/api/business/client/routines')) {
    return;
  }
  console.log('client/routines response', response.status(), response.url());
  try {
    console.log(await response.text());
  } catch (error) {
    console.log('response body unavailable', error);
  }
});

await login(page, '/client/login', CLIENT_EMAIL, CLIENT_PASSWORD);
await page.waitForURL(/\/client\/dashboard$/);

const clientUser = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('business-site:client-user') ?? 'null')
);
const clientToken = await page.evaluate(() =>
  localStorage.getItem('business-site:client-token')
);
console.log('client user after client login', clientUser);

await login(page, '/owner/login', OWNER_EMAIL, OWNER_PASSWORD);
await page.waitForURL(/\/owner\/dashboard$/);

const ownerUser = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('business-site:user') ?? 'null')
);
const clientUserAfterOwnerLogin = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('business-site:client-user') ?? 'null')
);
console.log('owner user after owner login', ownerUser);
console.log('client user after owner login', clientUserAfterOwnerLogin);

const siteConfig = await page.evaluate(async ({ ownerToken }) => {
  const response = await fetch('/api/business/site-config', {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'x-ot-appscope': 'business-site',
    },
  });
  return response.json();
}, { ownerToken: ownerUser?.token });

siteConfig.config.features.clientTasks.enabled = true;
siteConfig.config.features.clientTasks.allowClientCompletion = true;

await page.evaluate(async ({ ownerToken, configId, config }) => {
  await fetch('/api/business/site-config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
      'x-ot-appscope': 'business-site',
    },
    body: JSON.stringify({ configId, config }),
  });
}, { ownerToken: ownerUser?.token, configId: siteConfig.id, config: siteConfig.config });

const routineTitle = `debug-routine-${Date.now()}`;
const createdRoutine = await page.evaluate(async ({ ownerToken, clientId, routineTitle }) => {
  const response = await fetch('/api/business/owner/routines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
      'x-ot-appscope': 'business-site',
    },
    body: JSON.stringify({
      clientId,
      clientName: 'Debug Client',
      title: routineTitle,
      summary: 'Debug summary',
      focusAreas: ['Strength'],
    }),
  });
  return response.json();
}, {
  ownerToken: ownerUser?.token,
  clientId: clientUserAfterOwnerLogin?.userId,
  routineTitle,
});
console.log('created routine', createdRoutine);

const apiRoutines = await page.evaluate(async ({ clientToken, clientId }) => {
  const response = await fetch(`/api/business/client/routines?clientId=${encodeURIComponent(clientId)}`, {
    headers: {
      Authorization: `Bearer ${clientToken}`,
      'x-ot-appscope': 'business-site',
    },
  });
  return response.json();
}, { clientToken, clientId: clientUserAfterOwnerLogin?.userId });
console.log('api routines direct', apiRoutines);

await page.goto(`${BASE_URL}/client/routines`);
await page.waitForTimeout(3000);
console.log('page text', await page.locator('body').innerText());

await browser.close();
