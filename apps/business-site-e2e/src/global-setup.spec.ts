import type { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import net from 'node:net';

import globalSetup, {
  getBuildCommand,
  getComposeArgs,
  getSetupSeedCommands,
  getStackStartupCommands,
} from '../global-setup';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('node:net', () => ({ connect: jest.fn() }));

/**
 * The spec beside this one asserts the shape of the exported command builders.
 * This one drives `globalSetup` itself — the phased ordering, the retry loops
 * and the failure paths, none of which the shape tests reach.
 *
 * That matters because when this function is wrong the e2e suite fails with a
 * bare Playwright timeout that says nothing about which phase broke.
 *
 * `spawn`, `net.connect` and `fetch` are all replaced, so nothing here starts a
 * container, opens a socket or makes a request.
 */

type ExitHandler = (code: number | null) => void;
type ErrorHandler = (error: Error) => void;

interface FakeChild {
  on(event: 'error' | 'exit', handler: ErrorHandler | ExitHandler): void;
}

const spawnMock = spawn as unknown as jest.Mock;
const connectMock = net.connect as unknown as jest.Mock;

/**
 * Each spawned command, socket and request takes the next outcome queued here,
 * so a test can let the first seven commands succeed and fail the eighth. An
 * empty queue means "succeed", which keeps the happy-path tests to one line.
 */
let spawnOutcomes: ({ exit: number } | { error: string })[];
let socketOutcomes: ('connect' | 'error')[];
let fetchOutcomes: ({ ok: boolean } | { throws: true })[];

const shiftOr = <T>(queue: T[], fallback: T): T =>
  queue.length > 0 ? (queue.shift() as T) : fallback;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  spawnOutcomes = [];
  socketOutcomes = [];
  fetchOutcomes = [];

  spawnMock.mockReset();
  spawnMock.mockImplementation((): FakeChild => {
    const handlers: { error?: ErrorHandler; exit?: ExitHandler } = {};
    const outcome = shiftOr<{ exit: number } | { error: string }>(
      spawnOutcomes,
      { exit: 0 }
    );

    // Emitted on a microtask so both listeners are attached first, the way a
    // real child process behaves. `Promise.resolve` rather than
    // `queueMicrotask`, which the fake timers replace — a faked microtask only
    // runs on a tick, which would stall the setup's own `await` chain.
    void Promise.resolve().then(() => {
      if ('error' in outcome) {
        handlers.error?.(new Error(outcome.error));
        return;
      }
      handlers.exit?.(outcome.exit);
    });

    return {
      on(event: 'error' | 'exit', handler: ErrorHandler | ExitHandler) {
        if (event === 'error') {
          handlers.error = handler as ErrorHandler;
        } else {
          handlers.exit = handler as ExitHandler;
        }
      },
    };
  });

  connectMock.mockReset();
  connectMock.mockImplementation(() => {
    const handlers: Record<string, () => void> = {};
    const outcome = shiftOr<'connect' | 'error'>(socketOutcomes, 'connect');

    void Promise.resolve().then(() => handlers[outcome]?.());

    return {
      once(event: string, handler: () => void) {
        handlers[event] = handler;
      },
      end: jest.fn(),
      destroy: jest.fn(),
    };
  });

  globalThis.fetch = jest.fn(async () => {
    const outcome = shiftOr<{ ok: boolean } | { throws: true }>(fetchOutcomes, {
      ok: true,
    });
    if ('throws' in outcome) {
      throw new Error('connection refused');
    }
    return { ok: outcome.ok } as Response;
  }) as unknown as typeof fetch;

  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
  delete process.env['SKIP_SETUP'];
  jest.restoreAllMocks();
});

/**
 * Drives both clocks together: the retry loops sit behind
 * `setTimeout(..., 1000)` while everything else resolves on microtasks, and the
 * async timer API flushes both.
 */
const settle = async (ticks = 20) => {
  for (let i = 0; i < ticks; i++) {
    await jest.advanceTimersByTimeAsync(1000);
  }
};

const commandLines = () =>
  spawnMock.mock.calls.map(
    ([command, args]: [string, string[]]) => `${command} ${args.join(' ')}`
  );

describe('compose arguments', () => {
  it('layers the e2e overrides on top of the base and dev compose files', () => {
    expect(getComposeArgs()).toEqual([
      'compose',
      '-f',
      'docker-compose.yaml',
      '-f',
      'docker-compose.dev.yaml',
      '-f',
      'apps/business-site-e2e/docker-compose.e2e.yaml',
    ]);
  });
});

describe('build command', () => {
  const build = getBuildCommand('/workspace');

  it('builds every service the business-site stack depends on', () => {
    const projects = build.args
      .find((arg) => arg.startsWith('--projects='))
      ?.replace('--projects=', '')
      .split(',');

    expect(projects).toEqual([
      'authentication',
      'profile',
      'permissions',
      'store',
      'lead-tracker',
      'gateway',
      'business-site',
    ]);
  });

  it('skips the Nx cache so a stale artifact cannot be served to the browser', () => {
    expect(build.args).toContain('--skip-nx-cache');
    expect(build.args).toContain('--configuration=development');
  });

  it('disables the Nx daemon and plugin isolation', () => {
    // Both leave orphaned processes behind when CI tears the run down.
    expect(build.env).toEqual({
      NX_DAEMON: 'false',
      NX_ISOLATE_PLUGINS: 'false',
    });
    expect(build.cwd).toBe('/workspace');
  });
});

describe('stack startup commands', () => {
  const commands = getStackStartupCommands('/workspace');

  it('brings the stack up in dependency order', () => {
    // Data stores, then migrations, then the services, then the site itself.
    // Starting business-site any earlier points it at an unmigrated database.
    const phases = commands.map((c) =>
      c.args.slice(getComposeArgs().length).join(' ')
    );

    expect(phases).toEqual([
      'down -v --remove-orphans',
      'up -d postgres redis',
      'up -d db-setup',
      'wait db-setup',
      'up -d --no-deps authentication profile permissions store lead-tracker gateway',
      'up -d --no-deps business-site',
    ]);
  });

  it('waits for the migration container to exit before starting services', () => {
    const waitIndex = commands.findIndex((c) => c.args.includes('wait'));
    const servicesIndex = commands.findIndex((c) =>
      c.args.includes('authentication')
    );

    expect(waitIndex).toBeLessThan(servicesIndex);
  });

  it('runs every phase as docker from the workspace root', () => {
    const composeArgs = getComposeArgs();

    expect(commands.every((c) => c.command === 'docker')).toBe(true);
    expect(commands.every((c) => c.cwd === '/workspace')).toBe(true);
    expect(
      commands.every((c) => composeArgs.every((arg, i) => c.args[i] === arg))
    ).toBe(true);
  });
});

describe('seed commands', () => {
  const seeds = getSetupSeedCommands('/workspace');

  it('seeds permissions before business data', () => {
    // The business seed assigns roles the permission seed has to create first.
    expect(seeds.map((s) => s.command)).toEqual(['sh', 'node']);
    expect(seeds[0].args[0]).toContain('scripts/seed-permissions.sh');
    expect(seeds[1].args[0]).toContain('seed-business.mjs');
  });

  it('skips user assignments in the permission seed', () => {
    // The business seed creates the users, so assigning to them first would
    // run against an empty profile table.
    expect(seeds[0].env).toEqual({
      POSTGRES_HOST: '127.0.0.1',
      POSTGRES_DB: 'ot_permissions',
      SKIP_PERMISSION_USER_ASSIGNMENTS: 'true',
    });
  });

  it('points the business seed at the gateway and the business-site scope', () => {
    expect(seeds[1].env).toEqual({
      GATEWAY_URL: 'http://localhost:3000/api',
      APP_SCOPE: 'business-site',
      POSTGRES_HOST: '127.0.0.1',
    });
  });
});

describe('globalSetup', () => {
  const config = {} as FullConfig;

  it('does nothing at all when SKIP_SETUP is set', async () => {
    process.env['SKIP_SETUP'] = 'true';

    await globalSetup(config);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('builds, starts the stack, waits, then seeds', async () => {
    const done = globalSetup(config);
    await settle();
    await expect(done).resolves.toBeUndefined();

    const lines = commandLines();

    // One build, six startup phases, two seeds.
    expect(lines).toHaveLength(9);
    expect(lines[0]).toContain('nx run-many');
    expect(lines[1]).toContain('down -v --remove-orphans');
    expect(lines[8]).toContain('seed-business.mjs');
  });

  it('waits for both the gateway and the business-site ports', async () => {
    const done = globalSetup(config);
    await settle();
    await done;

    expect(connectMock.mock.calls.map(([port]) => port)).toEqual([3000, 8094]);
  });

  it('waits for both site-config endpoints to answer', async () => {
    const done = globalSetup(config);
    await settle();
    await done;

    expect(
      (globalThis.fetch as jest.Mock).mock.calls.map(([url]) => url)
    ).toEqual([
      'http://127.0.0.1:3000/api/business/site-config',
      'http://127.0.0.1:8094/api/business/site-config',
    ]);
  });

  it('seeds only after the stack answers, never before', async () => {
    const done = globalSetup(config);
    await settle();
    await done;

    const seedIndex = commandLines().findIndex((line) =>
      line.includes('seed-permissions.sh')
    );

    // Everything spawned before the seeds is the build or a docker phase, so
    // the ports were already answering by the time the seed ran.
    expect(seedIndex).toBe(7);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('retries a refused port until it opens', async () => {
    socketOutcomes = ['error', 'error', 'connect'];

    const done = globalSetup(config);
    await settle();
    await done;

    // Two refusals on port 3000, then the connection, then port 8094.
    expect(connectMock).toHaveBeenCalledTimes(4);
  });

  it('retries an endpoint that is up but not yet serving', async () => {
    fetchOutcomes = [{ throws: true }, { ok: false }, { ok: true }];

    const done = globalSetup(config);
    await settle();
    await done;

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('fails with the exit code when a startup command fails', async () => {
    // The build succeeds; the compose `down` does not.
    spawnOutcomes = [{ exit: 0 }, { exit: 137 }];

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow('exited with code 137');
    await settle();

    await rejection;
  });

  it('fails when a command cannot be spawned at all', async () => {
    spawnOutcomes = [{ error: 'pnpm not found' }];

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow('pnpm not found');
    await settle();

    await rejection;
  });

  it('stops before the stack starts when the build fails', async () => {
    spawnOutcomes = [{ exit: 1 }];

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow('exited with code 1');
    await settle();
    await rejection;

    // Only the build ran — no container was created.
    expect(commandLines()).toHaveLength(1);
    expect(spawnMock.mock.calls[0][0]).toBe('pnpm');
  });

  it('fails when a seed script fails', async () => {
    // Seven successes get through the build and the six docker phases.
    spawnOutcomes = [...Array(7).fill({ exit: 0 }), { exit: 2 }];

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow('exited with code 2');
    await settle();

    await rejection;
  });

  it('gives up on a port that never opens', async () => {
    // Enough refusals to outlast the budget below.
    socketOutcomes = Array(400).fill('error');

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow(
      'Timed out waiting for 127.0.0.1:3000'
    );

    await settle(2);
    // Five minutes of one-second retries, run through in a single advance.
    await jest.advanceTimersByTimeAsync(301_000);

    await rejection;
  });

  it('gives up on an endpoint that never answers', async () => {
    fetchOutcomes = Array(400).fill({ ok: false });

    const done = globalSetup(config);
    const rejection = expect(done).rejects.toThrow(
      'Timed out waiting for http://127.0.0.1:3000/api/business/site-config'
    );

    await settle(2);
    await jest.advanceTimersByTimeAsync(301_000);

    await rejection;
  });
});
