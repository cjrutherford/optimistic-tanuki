import { expect, test } from '@playwright/test';
import {
  ALWAYS_ALLOWED,
  NAV_TARGETS,
  openLeaf,
  firstTownId,
  selectTown,
  expectPageHeader,
  signInAsOwner,
  watchProblems,
} from './support/nav';

/**
 * Full-stack navigation smoke: sign in as the stack's owner and open every
 * page in OWNER_NAV. The CI stack does not provision an owner account, so the
 * run needs OWNER_EMAIL and OWNER_PASSWORD; without them it skips and says so.
 */
const email = process.env['OWNER_EMAIL'];
const password = process.env['OWNER_PASSWORD'];

test.describe('Owner console navigation smoke (full stack)', () => {
  test.skip(
    !email || !password,
    'OWNER_EMAIL and OWNER_PASSWORD are not set: the stack has no provisioned owner account'
  );

  test('every OWNER_NAV page renders a header without errors', async ({
    page,
  }) => {
    test.setTimeout(10 * 60_000);
    const townId = await firstTownId(page, email as string, password as string);
    await signInAsOwner(page, email as string, password as string);
    if (townId) await selectTown(page, townId);
    // Watch only once signed in: the signed-out session probe is a 401 by design.
    const problems = watchProblems(page, ALWAYS_ALLOWED);
    const unavailable: string[] = [];

    for (const target of NAV_TARGETS) {
      await test.step(target.leaf.label, async () => {
        if (target.leaf.needsTown && !townId) {
          test.info().annotations.push({
            type: 'skipped-leaf',
            description: `${target.leaf.path}: the seed has no towns`,
          });
          return;
        }
        const path = await openLeaf(page, target, townId);
        await expectPageHeader(page, path);
        // Record, do not fail: whether a source is up depends on the seed.
        if ((await page.getByText('Unavailable').count()) > 0) {
          unavailable.push(path);
        }
      });
    }

    if (unavailable.length) {
      test.info().annotations.push({
        type: 'unavailable-sources',
        description: unavailable.join(', '),
      });
    }
    expect(problems.pageErrors, 'uncaught page errors').toEqual([]);
    expect(problems.consoleErrors, 'console errors').toEqual([]);
  });
});
