import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseComposePsJson,
  prepareRunner,
  resolveReadinessOptions,
  waitForE2eReadiness,
} from '../wait-for-e2e-readiness.mjs';

function makeRuntime({ psSnapshots, responses = [] }) {
  const commands = [];
  const messages = [];
  let snapshotIndex = 0;
  let responseIndex = 0;
  let now = 0;

  return {
    commands,
    messages,
    run: async (command, args) => {
      commands.push([command, ...args]);
      if (args.at(-1) === 'json') {
        const snapshot =
          psSnapshots[Math.min(snapshotIndex, psSnapshots.length - 1)];
        snapshotIndex += 1;
        return JSON.stringify(snapshot);
      }
      return `${command} ${args.join(' ')}`;
    },
    fetch: async () =>
      responses[Math.min(responseIndex++, responses.length - 1)],
    now: () => now,
    sleep: async (milliseconds) => {
      now += milliseconds;
    },
    info: (message) => messages.push(message),
    error: (message) => messages.push(message),
  };
}

test('parses both array and newline-delimited Compose ps JSON', () => {
  const rows = [
    { Service: 'db', State: 'running', Health: 'healthy' },
    { Service: 'db-setup', State: 'exited', ExitCode: 0 },
  ];

  assert.deepEqual(parseComposePsJson(JSON.stringify(rows)), rows);
  assert.deepEqual(parseComposePsJson(JSON.stringify(rows[0])), [rows[0]]);
  assert.deepEqual(
    parseComposePsJson(rows.map((row) => JSON.stringify(row)).join('\n')),
    rows
  );
  assert.deepEqual(parseComposePsJson(''), []);
});

test('waits for db-setup success before probing dependent services and URLs', async () => {
  const runtime = makeRuntime({
    psSnapshots: [
      [
        { Service: 'db-setup', State: 'running' },
        { Service: 'gateway', State: 'running' },
      ],
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'gateway', State: 'running' },
      ],
    ],
    responses: [{ ok: true, status: 200 }],
  });

  await waitForE2eReadiness(
    {
      composeFiles: ['e2e/docker-compose.e2e-stack.yaml'],
      requiredServices: ['db-setup', 'gateway'],
      requiredUrls: ['http://127.0.0.1:3000/api'],
      timeoutMs: 50,
      intervalMs: 10,
    },
    runtime
  );

  assert.deepEqual(runtime.commands[0], [
    'docker',
    'compose',
    '-f',
    'e2e/docker-compose.e2e-stack.yaml',
    'ps',
    '--all',
    '--format',
    'json',
  ]);
  assert.equal(
    runtime.commands.filter(([command]) => command === 'docker').length,
    2
  );
  assert.equal(
    runtime.messages.filter((message) => message.includes('http://')).length,
    1
  );
});

test('uses the target-owned Compose project for status and failure diagnostics', async () => {
  const runtime = makeRuntime({
    psSnapshots: [[{ Service: 'db-setup', State: 'exited', ExitCode: 1 }]],
  });

  await assert.rejects(
    waitForE2eReadiness(
      {
        composeFiles: ['stack.yaml'],
        composeProject: 'ot-e2e-target-42',
        requiredServices: ['db-setup'],
        requiredUrls: [],
        timeoutMs: 50,
        intervalMs: 10,
      },
      runtime
    )
  );

  assert.ok(
    runtime.commands.every(
      ([, ...args]) =>
        args.includes('--project-name') && args.includes('ot-e2e-target-42')
    )
  );
});

test('supports container-only readiness when a microservice has no HTTP health route', async () => {
  const runtime = makeRuntime({
    psSnapshots: [
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'assets', State: 'running' },
      ],
    ],
  });

  await waitForE2eReadiness(
    {
      composeFiles: ['stack.yaml'],
      requiredServices: ['db-setup', 'assets'],
      requiredUrls: [],
      timeoutMs: 50,
      intervalMs: 10,
    },
    runtime
  );

  assert.equal(
    runtime.commands.filter(([command]) => command === 'docker').length,
    1
  );
  assert.ok(runtime.messages.some((message) => message.includes('assets')));
});

test('waits for services reporting a Compose health state to become healthy', async () => {
  const runtime = makeRuntime({
    psSnapshots: [
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'forum', State: 'running', Health: 'starting' },
      ],
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'forum', State: 'running', Health: 'healthy' },
      ],
    ],
  });

  await waitForE2eReadiness(
    {
      composeFiles: ['stack.yaml'],
      requiredServices: ['db-setup', 'forum'],
      requiredUrls: [],
      timeoutMs: 50,
      intervalMs: 10,
    },
    runtime
  );

  assert.equal(
    runtime.commands.filter(([command]) => command === 'docker').length,
    2
  );
});

test('accepts successful exited seed services instead of requiring them to remain running', async () => {
  const runtime = makeRuntime({
    psSnapshots: [
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'app-configurator-seed', State: 'exited', ExitCode: 0 },
        { Service: 'app-configurator', State: 'running' },
      ],
    ],
    responses: [{ ok: true, status: 200 }],
  });

  await waitForE2eReadiness(
    {
      composeFiles: ['stack.yaml'],
      requiredServices: [
        'db-setup',
        'app-configurator-seed',
        'app-configurator',
      ],
      completedServices: ['db-setup', 'app-configurator-seed'],
      requiredUrls: ['http://127.0.0.1:3014'],
      timeoutMs: 50,
      intervalMs: 10,
    },
    runtime
  );
});

test('emits compose ps and logs diagnostics when db-setup exits unsuccessfully', async () => {
  const runtime = makeRuntime({
    psSnapshots: [[{ Service: 'db-setup', State: 'exited', ExitCode: 1 }]],
  });

  await assert.rejects(
    waitForE2eReadiness(
      {
        composeFiles: ['stack.yaml'],
        requiredServices: ['db-setup', 'gateway'],
        requiredUrls: ['http://127.0.0.1:3000/api'],
        timeoutMs: 50,
        intervalMs: 10,
      },
      runtime
    ),
    /db-setup exited unsuccessfully/
  );

  assert.deepEqual(runtime.commands.slice(-2), [
    ['docker', 'compose', '-f', 'stack.yaml', 'ps'],
    [
      'docker',
      'compose',
      '-f',
      'stack.yaml',
      'logs',
      '--tail',
      '100',
      'db-setup',
      'gateway',
    ],
  ]);
});

test('fails after a bounded timeout when required HTTP endpoints remain unavailable', async () => {
  const runtime = makeRuntime({
    psSnapshots: [
      [
        { Service: 'db-setup', State: 'exited', ExitCode: 0 },
        { Service: 'gateway', State: 'running' },
      ],
    ],
    responses: [{ ok: false, status: 503 }],
  });

  await assert.rejects(
    waitForE2eReadiness(
      {
        composeFiles: ['stack.yaml'],
        requiredServices: ['db-setup', 'gateway'],
        requiredUrls: ['http://127.0.0.1:3000/api'],
        timeoutMs: 20,
        intervalMs: 10,
      },
      runtime
    ),
    /Timed out waiting for E2E readiness/
  );

  assert.ok(runtime.commands.some((command) => command.includes('logs')));
});

test('resolves a manifest target to its compose files, dependency closure, and target readiness URL', () => {
  assert.deepEqual(
    resolveReadinessOptions({ target: 'client-interface-e2e' }),
    {
      composeFiles: ['e2e/docker-compose.e2e-stack.yaml'],
      requiredServices: [
        'db',
        'db-setup',
        'authentication',
        'profile',
        'social',
        'permissions',
        'permissions-seed',
        'chat-collector',
        'forum',
        'telos-docs-service',
        'oauth-provider',
        'gateway',
        'client-interface',
      ],
      requiredUrls: ['http://127.0.0.1:8080', 'http://127.0.0.1:3000/api-docs'],
      completedServices: ['db-setup', 'permissions-seed'],
    }
  );
  assert.deepEqual(resolveReadinessOptions({ target: 'assets-e2e' }), {
    composeFiles: ['e2e/docker-compose.e2e-stack.yaml'],
    requiredServices: ['db', 'db-setup', 'assets'],
    requiredUrls: [],
    completedServices: ['db-setup'],
  });
  assert.deepEqual(resolveReadinessOptions({ target: 'business-site-e2e' }), {
    composeFiles: [
      'docker-compose.yaml',
      'docker-compose.dev.yaml',
      'apps/business-site-e2e/docker-compose.e2e.yaml',
    ],
    requiredServices: [
      'postgres',
      'redis',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'store',
      'lead-tracker',
      'gateway',
      'business-site',
    ],
    requiredUrls: ['http://127.0.0.1:8094/api/business/site-config'],
    completedServices: ['db-setup'],
  });
});

test('prepare-runner only performs global Docker cleanup with explicit GitHub-runner authorization', async () => {
  const runtime = makeRuntime({ psSnapshots: [] });

  await prepareRunner(runtime, { allowGlobalPrune: false });

  assert.deepEqual(runtime.commands, [
    ['df', '-h'],
    ['docker', 'system', 'df'],
  ]);

  const authorizedRuntime = makeRuntime({ psSnapshots: [] });
  await prepareRunner(authorizedRuntime, { allowGlobalPrune: true });

  assert.deepEqual(authorizedRuntime.commands, [
    ['df', '-h'],
    ['docker', 'system', 'df'],
    ['docker', 'system', 'prune', '-af', '--volumes'],
    ['df', '-h'],
    ['docker', 'system', 'df'],
  ]);
});
