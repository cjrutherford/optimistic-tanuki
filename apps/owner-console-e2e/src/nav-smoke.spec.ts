import { expect, test } from '@playwright/test';
import {
  FULL_STACK_ALLOWED,
  NAV_TARGETS,
  openLeaf,
  firstTownId,
  selectTown,
  expectPageHeader,
  signInAsOwner,
  watchProblems,
} from './support/nav';
import {
  OWNER_ENV_MISSING_REASON,
  ownerCredentials,
} from './support/owner-credentials';

/**
 * Full-stack navigation smoke: sign in as the stack's owner and open every
 * page in OWNER_NAV. The run needs OWNER_EMAIL and OWNER_PASSWORD (global setup provisions the
 * account). Locally, without them it skips and says so; in CI it fails.
 */
// Throws in CI when the owner env is missing, so the suite cannot skip green.
const owner = ownerCredentials();
const email = owner?.email;
const password = owner?.password;

test.describe('Owner console navigation smoke (full stack)', () => {
  test.skip(!owner, OWNER_ENV_MISSING_REASON);

  test('every OWNER_NAV page renders a header without errors', async ({
    page,
  }) => {
    test.setTimeout(10 * 60_000);
    const townId = await firstTownId(page, email as string, password as string);
    await signInAsOwner(page, email as string, password as string);
    if (townId) await selectTown(page, townId);
    // Watch only once signed in: the signed-out session probe is a 401 by design.
    const problems = watchProblems(page, FULL_STACK_ALLOWED);
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
    if (problems.failedResponses.length) {
      const counts = new Map<string, number>();
      for (const line of problems.failedResponses) {
        counts.set(line, (counts.get(line) ?? 0) + 1);
      }
      test.info().annotations.push({
        type: 'failed-responses',
        description: [...counts]
          .map(([line, count]) => (count > 1 ? `${line} x${count}` : line))
          .join('\n'),
      });
    }
    expect(problems.pageErrors, 'uncaught page errors').toEqual([]);
    expect(problems.consoleErrors, 'console errors').toEqual([]);
  });
});
