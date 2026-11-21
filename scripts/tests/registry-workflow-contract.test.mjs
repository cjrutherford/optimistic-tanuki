import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';

const workflow = yaml.load(
  readFileSync(
    new URL('../../.github/workflows/ci-cd.yml', import.meta.url),
    'utf8'
  )
);

test('registry jobs limit fanout while preserving failure and downstream gates', () => {
  const {
    image_check: check,
    publish_images: publish,
    microservices_e2e: e2e,
  } = workflow.jobs;
  for (const job of [check, publish]) {
    assert.equal(job.strategy['max-parallel'], 2);
    assert.equal(job.strategy['fail-fast'], false);
    assert.ok(job.strategy.matrix);
    assert.ok(!job['continue-on-error']);
  }
  const build = check.steps.find((step) =>
    step.uses?.startsWith('docker/build-push-action@')
  );
  assert.ok(build && !build['continue-on-error']);
  assert.match(
    check.steps.find((step) =>
      step.uses?.startsWith('docker/setup-buildx-action@')
    ).with['buildkitd-config-inline'],
    /max-parallelism\s*=\s*2/
  );
  assert.match(publish.if, /needs\.image_check\.result == 'success'/);
  assert.match(e2e.if, /needs\.image_check\.result == 'success'/);
});
