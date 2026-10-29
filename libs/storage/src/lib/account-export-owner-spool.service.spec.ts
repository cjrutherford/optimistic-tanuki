import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, ftruncateSync } from 'node:fs';
import {
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
  ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolError,
} from './account-export-owner-spool.service';

type Source = 'alpha' | 'beta';
const PARTICIPANT = 'fixture-participant';
const ACCOUNT = randomUUID();
const CAPTURE = randomUUID();
const SNAPSHOT = '2026-10-19T15:00:00.000Z';

function makeCapture(): AccountExportOwnerChunk<Source>[] {
  const records = [
    {
      source: 'alpha' as const,
      data: { id: 'a-1', accountId: ACCOUNT, value: 'first' },
    },
    {
      source: 'alpha' as const,
      data: { id: 'a-2', accountId: ACCOUNT, value: 'second' },
    },
    {
      source: 'alpha' as const,
      data: { id: 'a-3', accountId: ACCOUNT, value: 'third' },
    },
  ];
  const digest = createHash('sha256');
  for (const record of records) digest.update(`${JSON.stringify(record)}\n`);
  const common = {
    contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
    schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
    participantId: PARTICIPANT,
    accountId: ACCOUNT,
    captureId: CAPTURE,
    snapshotAt: SNAPSHOT,
    endOfStream: false,
    complete: false,
    uncovered: [] as string[],
  };
  const chunks: AccountExportOwnerChunk<Source>[] = [
    {
      ...common,
      pageOrdinal: 1,
      source: 'alpha',
      cursor: 'a-2',
      records: records.slice(0, 2),
      sourceComplete: false,
    },
    {
      ...common,
      pageOrdinal: 2,
      source: 'alpha',
      cursor: 'a-3',
      records: records.slice(2),
      sourceComplete: true,
    },
    {
      ...common,
      pageOrdinal: 3,
      source: 'beta',
      cursor: null,
      records: [],
      sourceComplete: true,
    },
    {
      ...common,
      pageOrdinal: 4,
      source: 'end',
      cursor: null,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: records.length,
      checksum: digest.digest('hex'),
      sourceRowCounts: { alpha: 3, beta: 0 },
      sourceDispositions: { alpha: 'retained', beta: 'none-retained' },
    },
  ];
  return chunks;
}

async function consumeAll(
  handle: Awaited<ReturnType<AccountExportOwnerSpoolService['capture']>>
): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const part of handle.createReadStream())
    parts.push(Buffer.from(part));
  return Buffer.concat(parts);
}

describe('AccountExportOwnerSpoolService', () => {
  let root: string;
  let service: AccountExportOwnerSpoolService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ot-owner-spool-test-'));
    service = new AccountExportOwnerSpoolService();
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  const options = (
    overrides: Partial<
      Parameters<AccountExportOwnerSpoolService['capture']>[0]
    > = {}
  ) => ({
    participantId: PARTICIPANT,
    accountId: ACCOUNT,
    sources: ['alpha', 'beta'] as const,
    spoolRoot: root,
    ...overrides,
  });

  it('stages multiple verified pages in an unlinked private file and exposes bounded readback', async () => {
    const chunks = makeCapture();
    const handle = await service.capture(options(), async (onChunk) => {
      if (process.platform === 'linux') await expectUnlinkedPrivateDescriptor();
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[chunks.length - 1];
    });
    expect(await readdir(root)).toEqual([]);
    expect(handle.metadata).toMatchObject({
      participantId: PARTICIPANT,
      accountId: ACCOUNT,
      captureId: CAPTURE,
      rowCount: 3,
      sourceRowCounts: { alpha: 3, beta: 0 },
    });
    const bytes = await consumeAll(handle);
    expect(bytes.toString('utf8').trim().split('\n')).toHaveLength(4);
    expect(bytes).toHaveLength(handle.metadata.sizeBytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      handle.metadata.sha256
    );
    expect(await handle.readChunk(0, Math.min(20, bytes.length))).toEqual(
      bytes.subarray(0, 20)
    );
    await handle.cleanup();
    await expect(handle.readChunk(0, 1)).rejects.toMatchObject({
      code: 'OWNER_SPOOL_CLOSED',
    });
    expect(() => handle.createReadStream()).toThrow(OwnerSpoolError);
  });

  async function expectUnlinkedPrivateDescriptor(): Promise<void> {
    const descriptors = await readdir('/proc/self/fd');
    let proved = false;
    for (const descriptor of descriptors) {
      try {
        const target = await readlink(`/proc/self/fd/${descriptor}`);
        if (
          !target.startsWith(join(root, 'ot-owner-spool-')) ||
          !target.endsWith('(deleted)')
        )
          continue;
        const descriptorStat = await stat(`/proc/self/fd/${descriptor}`);
        expect(descriptorStat.mode & 0o777).toBe(0o600);
        proved = true;
        break;
      } catch {
        // The descriptor can close between enumeration and inspection.
      }
    }
    expect(proved).toBe(true);
    expect(await readdir(root)).toEqual([]);
  }

  it.each([
    [
      'wrong participant',
      (chunks: AccountExportOwnerChunk<Source>[]) => {
        chunks[0].participantId = 'other';
      },
    ],
    [
      'invalid order',
      (chunks: AccountExportOwnerChunk<Source>[]) => {
        chunks[0].pageOrdinal = 2;
      },
    ],
    [
      'bad digest',
      (chunks: AccountExportOwnerChunk<Source>[]) => {
        chunks[3].checksum = '0'.repeat(64);
      },
    ],
    [
      'missing terminal',
      (chunks: AccountExportOwnerChunk<Source>[]) => {
        chunks.pop();
      },
    ],
  ])('discards invalid capture: %s', async (name, mutate) => {
    const chunks = makeCapture();
    mutate(chunks);
    await expect(
      service.capture(options(), async (onChunk) => {
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[chunks.length - 1];
      })
    ).rejects.toMatchObject({
      code:
        name === 'missing terminal'
          ? 'OWNER_SPOOL_INCOMPLETE_CAPTURE'
          : 'OWNER_SPOOL_INVALID_CAPTURE',
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('requires producer terminal evidence to match the verified end envelope', async () => {
    const chunks = makeCapture();
    await expect(
      service.capture(options(), async (onChunk) => {
        for (const chunk of chunks) await onChunk(chunk);
        return { ...chunks[3], captureId: 'different-capture' };
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_INCOMPLETE_CAPTURE' });
  });

  it('rejects mutation of an accepted terminal object before producer return', async () => {
    const chunks = makeCapture();
    await expect(
      service.capture(options(), async (onChunk) => {
        for (const chunk of chunks) await onChunk(chunk);
        chunks[3].rowCount = 999;
        return chunks[3];
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_INCOMPLETE_CAPTURE' });
    expect(await readdir(root)).toEqual([]);
  });

  it('cleans an ended stream consumed with events and isolates expected options', async () => {
    const chunks = makeCapture();
    const configured = options();
    const handle = await service.capture(configured, async (onChunk) => {
      configured.accountId = 'changed-after-start';
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[3];
    });
    expect(handle.metadata.accountId).toBe(ACCOUNT);
    const stream = handle.createReadStream();
    const ended = new Promise<void>((resolve, reject) => {
      stream.once('end', resolve);
      stream.once('error', reject);
    });
    stream.resume();
    await ended;
    await handle.cleanup();
    expect(stream.closed).toBe(true);
  });

  it('enforces the configured complete spool byte budget', async () => {
    const chunks = makeCapture();
    await expect(
      service.capture(options({ maxBytes: 1 }), async (onChunk) => {
        for (const chunk of chunks) await onChunk(chunk);
        return chunks[3];
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_BYTE_LIMIT' });
    expect(await readdir(root)).toEqual([]);
  });

  it('fails closed on an unexpected short read from a damaged private spool', async () => {
    if (process.platform !== 'linux') return;
    const chunks = makeCapture();
    const handle = await service.capture(options(), async (onChunk) => {
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[3];
    });
    try {
      let damaged = false;
      for (const fd of await readdir('/proc/self/fd')) {
        let target: string;
        try {
          target = await readlink(`/proc/self/fd/${fd}`);
        } catch {
          continue;
        }
        if (
          target.startsWith(join(root, 'ot-owner-spool-')) &&
          target.endsWith('(deleted)')
        ) {
          ftruncateSync(Number(fd), 0);
          damaged = true;
          break;
        }
      }
      expect(damaged).toBe(true);
      await expect(handle.readChunk(0, 1)).rejects.toMatchObject({
        code: 'OWNER_SPOOL_IO_FAILED',
      });
    } finally {
      await handle.cleanup();
    }
  });

  it('leaves no staged path after abrupt exit of a process holding captured data', async () => {
    if (process.platform !== 'linux') return;
    const workspace = resolve(__dirname, '../../../..');
    const program = `
      const { createHash } = require('node:crypto');
      const { AccountExportOwnerSpoolService } = require(process.env.OWNER_SPOOL_SOURCE);
      (async () => {
        const record = { source: 'fixture', data: { id: '1' } };
        const base = { contractVersion: 1, schemaVersion: '2026-10-19.v1',
          participantId: 'fixture', accountId: 'fixture-account', captureId: 'fixture-capture',
          snapshotAt: '2026-10-19T00:00:00Z', cursor: '1', pageOrdinal: 1,
          source: 'fixture', records: [record], sourceComplete: true, endOfStream: false, complete: false };
        const end = { ...base, pageOrdinal: 2, source: 'end', cursor: null, records: [],
          endOfStream: true, complete: true, rowCount: 1, uncovered: [],
          sourceRowCounts: { fixture: 1 }, sourceDispositions: { fixture: 'Own fixture data' },
          checksum: createHash('sha256').update(JSON.stringify(record) + '\\n').digest('hex') };
        global.ownerFixture = await new AccountExportOwnerSpoolService().capture({
          participantId: 'fixture', accountId: 'fixture-account', sources: ['fixture'],
          spoolRoot: process.env.OWNER_SPOOL_ROOT }, async (sink) => {
            await sink(base); await sink(end); return end;
          });
        process.send({ ready: true, bytes: global.ownerFixture.metadata.sizeBytes });
        setInterval(() => {}, 1000);
      })().catch(() => { process.send({ ready: false }); process.exit(1); });
    `;
    const child = spawn(
      process.execPath,
      [
        '-r',
        require.resolve('ts-node/register/transpile-only'),
        '-r',
        require.resolve('tsconfig-paths/register'),
        '-e',
        program,
      ],
      {
        cwd: workspace,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: {
          PATH: process.env['PATH'],
          TS_NODE_PROJECT: join(workspace, 'tsconfig.base.json'),
          TS_NODE_COMPILER_OPTIONS: JSON.stringify({
            module: 'CommonJS',
            moduleResolution: 'node',
            experimentalDecorators: true,
          }),
          OWNER_SPOOL_SOURCE: resolve(
            __dirname,
            'account-export-owner-spool.service.ts'
          ),
          OWNER_SPOOL_ROOT: root,
        },
      }
    );
    let childError = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      childError = (childError + chunk.toString()).slice(-4000);
    });
    const deadline = setTimeout(() => child.kill('SIGKILL'), 45_000);
    const exited = once(child, 'exit');
    try {
      const ready = await Promise.race([
        once(child, 'message').then(
          ([value]) => value as { ready: boolean; bytes: number }
        ),
        exited.then(([code, signal]) => {
          throw new Error(
            `Fixture child exited before ready (code=${code}, signal=${signal}): ${childError}`
          );
        }),
      ]);
      expect(ready.ready).toBe(true);
      expect(ready.bytes).toBeGreaterThan(0);
      expect(await readdir(root)).toEqual([]);
      let heldDescriptor = false;
      for (const fd of await readdir(`/proc/${child.pid}/fd`)) {
        try {
          const target = await readlink(`/proc/${child.pid}/fd/${fd}`);
          if (
            target.startsWith(join(root, 'ot-owner-spool-')) &&
            target.endsWith('(deleted)')
          )
            heldDescriptor = true;
        } catch {
          /* Descriptor enumeration is inherently racy. */
        }
      }
      expect(heldDescriptor).toBe(true);
      child.kill('SIGKILL');
      const [, signal] = await exited;
      expect(signal).toBe('SIGKILL');
      expect(await readdir(root)).toEqual([]);
      await expect(readdir(`/proc/${child.pid}/fd`)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      clearTimeout(deadline);
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      await exited;
    }
  }, 60_000);

  it('rejects concurrent callback protocol and unawaited callbacks', async () => {
    const chunks = makeCapture();
    await expect(
      service.capture(options(), async (onChunk) => {
        await Promise.all([onChunk(chunks[0]), onChunk(chunks[1])]);
        return chunks[3];
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_CONCURRENT_CALLBACK' });
    expect(await readdir(root)).toEqual([]);

    await expect(
      service.capture(options(), async (onChunk) => {
        void onChunk(chunks[0]);
        return chunks[3];
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_INCOMPLETE_CAPTURE' });
  });

  it('aborts on caller cancellation and capture deadline, including a hung producer', async () => {
    const controller = new AbortController();
    const caller = service.capture(
      options({ signal: controller.signal }),
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        controller.abort();
        return makeCapture()[3];
      }
    );
    await expect(caller).rejects.toMatchObject({ code: 'OWNER_SPOOL_ABORTED' });

    let sawAbort = false;
    await expect(
      service.capture(options({ timeoutMs: 25 }), async (_onChunk, signal) => {
        signal.addEventListener(
          'abort',
          () => {
            sawAbort = true;
          },
          { once: true }
        );
        return new Promise<AccountExportOwnerChunk<Source>>(() => undefined);
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_TIMEOUT' });
    expect(sawAbort).toBe(true);
    expect(await readdir(root)).toEqual([]);
  });

  it('closes active readers and reports filesystem failures without leaking a path', async () => {
    const chunks = makeCapture();
    const handle = await service.capture(options(), async (onChunk) => {
      for (const chunk of chunks) await onChunk(chunk);
      return chunks[3];
    });
    const reader = handle.createReadStream();
    const closed = new Promise<void>((resolve) =>
      reader.once('close', resolve)
    );
    await handle.cleanup();
    await closed;

    const occupied = join(root, 'not-a-directory');
    await writeFile(occupied, 'fixture');
    await expect(
      service.capture(
        options({ spoolRoot: occupied }),
        async () => makeCapture()[3]
      )
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_IO_FAILED' });
    expect(await readFile(occupied, 'utf8')).toBe('fixture');
  });

  it('fails closed when an awaited page write fails', async () => {
    if (process.platform !== 'linux') return;
    const chunks = makeCapture();
    await expect(
      service.capture(options(), async (onChunk) => {
        const descriptors = await readdir('/proc/self/fd');
        let closed = false;
        for (const descriptor of descriptors) {
          try {
            const target = await readlink(`/proc/self/fd/${descriptor}`);
            if (
              target.startsWith(join(root, 'ot-owner-spool-')) &&
              target.endsWith('(deleted)')
            ) {
              closeSync(Number(descriptor));
              closed = true;
              break;
            }
          } catch {
            // Ignore unrelated descriptors that close during inspection.
          }
        }
        expect(closed).toBe(true);
        await onChunk(chunks[0]);
        return chunks[3];
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_IO_FAILED' });
    expect(await readdir(root)).toEqual([]);
  });
});
