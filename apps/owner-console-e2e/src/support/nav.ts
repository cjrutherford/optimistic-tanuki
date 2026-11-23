import { expect, Page } from '@playwright/test';
import {
  OWNER_NAV,
  OwnerNavGroup,
  OwnerNavLeaf,
} from '../../../owner-console/src/app/owner-nav';

/**
 * Every leaf of the owner console's navigation model. The specs import
 * `OWNER_NAV` itself rather than keeping a copy, so a page added to or removed
 * from the tree is visited (or dropped) by the next run with no list to
 * update. `owner-nav.spec.ts` in the app already fails when a routed page is
 * missing from the tree, so the chain route -> tree -> smoke has no gap.
 */
export interface NavTarget {
  group: OwnerNavGroup;
  leaf: OwnerNavLeaf;
}

export const NAV_TARGETS: readonly NavTarget[] = OWNER_NAV.flatMap((group) =>
  group.leaves.map((leaf) => ({ group, leaf }))
);

/**
 * A heading that belongs to the page. The app bar renders an "Owner Console"
 * h1 of its own, so a bare heading query would pass on a page with no header
 * at all. Pages that use `ot-owner-page-header` render an h1; older pages title
 * themselves with an h2, which still counts here.
 */
export const PAGE_HEADER = (page: Page) =>
  page
    .getByRole('heading')
    .filter({ hasNotText: /^\s*Owner Console\s*$/ })
    .first();

/** Assert the page shows a header of its own. */
export async function expectPageHeader(
  page: Page,
  path: string
): Promise<void> {
  await expect
    .soft(PAGE_HEADER(page), `${path} renders a page header`)
    .toBeVisible();
}

/** Fill the sign-in form on /login and submit it. */
export async function signInThroughForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page
    .locator('input[type="text"], input[type="email"]')
    .first()
    .fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form').getByRole('button').last().click();
}

/** Sign in and wait for the shell (the sidebar) to render. */
export async function signInAsOwner(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await signInThroughForm(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole('navigation', { name: 'Owner console' })
  ).toBeVisible();
}

/**
 * Pick a town through the app bar's town switcher, as an owner does. Waits for
 * the town list to load (the option appears) before choosing.
 */
export async function selectTown(page: Page, townId: string): Promise<void> {
  await page.locator('select[aria-label="Town"]').selectOption(townId);
}

/**
 * The id of the first town the stack knows, read as the owner through the
 * console's own proxy (the login cookie lands in the page's context), or null
 * when there are none or the call fails.
 */
export async function firstTownId(
  page: Page,
  email: string,
  password: string
): Promise<string | null> {
  const headers = {
    'x-ot-appscope': 'owner-console',
    'X-ot-session-mode': 'cookie',
  };
  const login = await page.request.post('/api/authentication/login', {
    headers,
    data: { email, password },
  });
  if (!login.ok()) return null;
  const towns = await page.request.get('/api/communities', {
    headers,
    params: { localityType: 'city' },
  });
  if (!towns.ok()) return null;
  const list = (await towns.json()) as Array<{ id?: string }>;
  return list.find((town) => town.id)?.id ?? null;
}

/**
 * Open a page the way an owner does: through the sidebar. A hard load of a
 * dashboard URL is server-rendered without the browser session and would
 * bounce to /login, so the specs navigate inside the running app instead.
 */
export async function openLeaf(
  page: Page,
  target: NavTarget,
  townId: string | null
): Promise<string> {
  const path = target.leaf.needsTown
    ? target.leaf.path.replace(':townId', encodeURIComponent(townId ?? ''))
    : target.leaf.path;
  const nav = page.getByRole('navigation', { name: 'Owner console' });
  const link = nav.locator(`a[href="${path}"]`);
  if (!(await link.isVisible())) {
    await nav
      .getByRole('button', { name: target.group.label, exact: false })
      .first()
      .click();
  }
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}(\\?|$)`));
  return path;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PageProblems {
  pageErrors: string[];
  consoleErrors: string[];
}

/**
 * Record uncaught page errors and console.error output from now on. Messages
 * matching `allow` are dropped; every allow-list entry must say why.
 */
export function watchProblems(
  page: Page,
  allow: readonly RegExp[]
): PageProblems {
  const problems: PageProblems = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (allow.some((pattern) => pattern.test(text))) return;
    problems.consoleErrors.push(text);
  });
  return problems;
}

/** Console errors that are benign on every run, full stack or mocked. */
export const ALWAYS_ALLOWED: readonly RegExp[] = [
  // Browsers request /favicon.ico on their own; the console does not ship one
  // at that path and the failure says nothing about a page.
  /Failed to load resource.*favicon/i,
];
