import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const navigations = [];

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    navigations.push(frame.url());
  }
});

await page.goto('http://127.0.0.1:4201/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

console.log(
  JSON.stringify(
    {
      navigations,
      finalUrl: page.url(),
      setupInterviewVisible: await page.locator('text=Setup Interview').isVisible(),
      navLinksVisible: await page.locator('.nav-links').count(),
    },
    null,
    2
  )
);

await browser.close();
