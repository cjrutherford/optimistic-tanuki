import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const composeFiles = [
  'docker-compose.yaml',
  'e2e/docker-compose.e2e-stack.yaml',
  'e2e/docker-compose.learning-e2e.yaml',
];

function serviceBlock(source, name) {
  const start = source.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `${name} must exist`);
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-zA-Z0-9_-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

for (const file of composeFiles) {
  test(`${file} isolates the runner from learning-service`, () => {
    const source = readFileSync(file, 'utf8');
    const runner = serviceBlock(source, 'learning-runner');
    const relay = serviceBlock(source, 'learning-runner-relay');
    const service = serviceBlock(source, 'learning-service');

    assert.match(runner, /networks: \[learning-runner-sandbox\]/);
    assert.doesNotMatch(runner, /learning-runner-control/);
    assert.match(
      relay,
      /networks: \[learning-runner-control, learning-runner-sandbox\]/
    );
    assert.match(service, /networks: \[default, learning-runner-control\]/);
    assert.doesNotMatch(service, /learning-runner-sandbox/);
    assert.match(
      service,
      /LEARNING_RUNNER_URL:.*http:\/\/learning-runner-relay:3025/
    );
  });
}

test('the relay exposes only the bounded run endpoint', () => {
  const source = readFileSync('apps/learning-runner/relay.nginx.conf', 'utf8');
  assert.match(source, /location = \/runs/);
  assert.match(source, /limit_except POST/);
  assert.match(source, /client_max_body_size 1m/);
  assert.doesNotMatch(source, /learning-service/);
});
