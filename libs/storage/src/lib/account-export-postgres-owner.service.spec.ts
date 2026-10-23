import { of } from 'rxjs';
import { AccountExportPostgresOwnerService } from './account-export-postgres-owner.service';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const grant: any = {
  accountId: account,
  appId: 'forum',
  token: 'secret',
  jobId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  attempt: 1,
  leaseOwner: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};
const descriptor: any = {
  participantId: 'profile',
  accountId: account,
  captureId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  handleId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  snapshotAt: '2026-10-20T12:00:00Z',
  expiresAt: '2026-10-20T12:05:00Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  identityCount: 1,
  sources: [],
  sourceRowCounts: {},
  sourceDispositions: {},
};

describe('AccountExportPostgresOwnerService', () => {
  function setup(
    options: {
      cleanupFails?: boolean;
      ids?: string[];
      sourceRows?: Record<string, unknown>[];
    } = {}
  ) {
    const events: string[] = [];
    const sourceNames = ['ForumPost', 'ForumThread'];
    const runner: any = {
      connect: jest.fn(async () => events.push('connect')),
      startTransaction: jest.fn(async (level: string) =>
        events.push(`begin:${level}`)
      ),
      commitTransaction: jest.fn(async () => events.push('commit')),
      rollbackTransaction: jest.fn(async () => events.push('rollback')),
      release: jest.fn(async () => events.push('release')),
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('CREATE TEMP')) {
          events.push('create-temp');
          return [];
        }
        if (sql.startsWith('DROP TABLE')) {
          events.push('drop-temp');
          if (options.cleanupFails) throw new Error('cleanup failed');
          return [];
        }
        if (sql.includes('transaction_timestamp'))
          return [{ snapshotAt: '2026-10-20 12:00:00' }];
        if (sql.startsWith('INSERT INTO')) {
          events.push('profile-identity');
          return [];
        }
        if (sql.startsWith('SELECT source')) return options.sourceRows ?? [];
        return [];
      }),
    };
    const identities: any = {
      readIdentities: jest.fn(
        async (
          _g: unknown,
          _d: unknown,
          page: (ids: readonly string[]) => Promise<void>
        ) => page(options.ids ?? [profile])
      ),
    };
    const auth: any = { send: jest.fn(() => of({ valid: true })) };
    const service = new AccountExportPostgresOwnerService(
      { createQueryRunner: () => runner } as any,
      identities,
      auth,
      {
        participantId: 'forum',
        sources: sourceNames,
        createSources: (table) =>
          sourceNames.map((source) => ({
            source,
            sql: `SELECT source FROM "${table}" WHERE $2 IS NULL OR id > $2 ORDER BY id LIMIT $3`,
            project: (row) => row,
          })),
      }
    );
    return { service, runner, identities, auth, events };
  }

  it('cleans the runner before terminal success and revalidates the lease', async () => {
    const { service, runner, auth, events } = setup();
    const chunks: any[] = [];
    const terminal = await service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        if (chunk.complete) events.push('terminal');
      },
    });
    expect(terminal.complete).toBe(true);
    expect(auth.send).toHaveBeenCalledTimes(5);
    expect(events.indexOf('drop-temp')).toBeLessThan(
      events.indexOf('terminal')
    );
    expect(events.indexOf('release')).toBeLessThan(events.indexOf('terminal'));
    expect(runner.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');
    expect(chunks.at(-1).checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('quarantines the owner after cleanup failure', async () => {
    const { service } = setup({ cleanupFails: true });
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
  });

  it('rejects malformed increasing keysets and oversize records', async () => {
    const malformed = setup({ sourceRows: [{ id: 'z' }, { id: 'a' }] });
    await expect(
      malformed.service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
    const oversize = setup({
      sourceRows: [{ id: 'a', content: 'x'.repeat(512 * 1024) }],
    });
    await expect(
      oversize.service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
  });

  it('honors cancellation and lease denial', async () => {
    const canceled = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      canceled.service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        signal: controller.signal,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_ABORTED' });
    const denied = setup();
    denied.auth.send.mockReturnValue(of({ valid: false }));
    await expect(
      denied.service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
  });

  it('bounds a stalled chunk consumer by the capture deadline', async () => {
    const { service } = setup();
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        captureTimeoutMs: 5,
        onChunk: () => new Promise<void>(() => undefined),
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_TIMEOUT' });
  });
});
