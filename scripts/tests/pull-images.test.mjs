import assert from 'node:assert/strict';
import test from 'node:test';

import { runPool, sleep } from '../lib/pull-images.mjs';

test('respects the concurrency limit and runs every task', async () => {
  let active = 0;
  let maxActive = 0;
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: index }));
  const completed = [];

  const outcome = await runPool(tasks, {
    concurrency: 2,
    retries: 0,
    pullOnce: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active -= 1;
      return { ok: true, seconds: 0 };
    },
    onResult: (task) => completed.push(task.id),
  });

  assert.equal(outcome.ok, true);
  assert.equal(completed.length, 7);
  assert.equal(new Set(completed).size, 7);
  assert.ok(
    maxActive <= 2,
    `expected at most 2 active pulls, saw ${maxActive}`
  );
});

test('retries a failed task and succeeds', async () => {
  const attempts = [];
  let retriesSeen = 0;

  const outcome = await runPool([{ id: 'assets' }], {
    concurrency: 1,
    retries: 2,
    retryDelay: 0,
    pullOnce: async (task, { attempt }) => {
      attempts.push(attempt);
      if (attempt < 3) {
        return { ok: false, message: 'connection reset', seconds: 0 };
      }
      return { ok: true, seconds: 0 };
    },
    onRetry: () => {
      retriesSeen += 1;
    },
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.equal(retriesSeen, 2);
});

test('gives up after the configured retries', async () => {
  let attempts = 0;

  const outcome = await runPool([{ id: 'assets' }], {
    concurrency: 1,
    retries: 2,
    retryDelay: 0,
    pullOnce: async () => {
      attempts += 1;
      return { ok: false, message: 'not found', seconds: 0 };
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(attempts, 3);
});

test('a fatal failure aborts the other in-flight pulls', async () => {
  const controller = new AbortController();
  const started = [];

  const outcome = await runPool([{ id: 1 }, { id: 2 }, { id: 3 }], {
    concurrency: 3,
    retries: 0,
    retryDelay: 0,
    abortController: controller,
    pullOnce: async (task, { signal }) => {
      started.push(task.id);
      if (task.id === 1) {
        await sleep(5);
        return { ok: false, message: 'fatal', seconds: 0 };
      }
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve, { once: true });
      });
      return { ok: false, aborted: true, message: 'aborted', seconds: 0 };
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(started.length, 3);
  const realFailures = outcome.results.filter(
    (result) => !result.ok && !result.aborted
  );
  assert.equal(realFailures.length, 1);
});
