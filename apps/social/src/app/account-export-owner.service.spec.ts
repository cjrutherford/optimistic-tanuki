import { of } from 'rxjs';
import { SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportOwnerEmitter: jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-owner-emitter'
  ).AccountExportOwnerEmitter,
  AccountExportProfileSnapshotClient: class {},
}));
import {
  SOCIAL_AUTHORED_SOURCES,
  SocialCaptureSource,
} from './account-export-authored.sources';
import { SocialAccountExportOwnerService } from './account-export-owner.service';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const grant: any = {
  accountId: account,
  appId: 'social',
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

describe('SocialAccountExportOwnerService', () => {
  function setup(failSelect = false) {
    const events: string[] = [];
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
          return [];
        }
        if (sql.includes('transaction_timestamp'))
          return [{ snapshotAt: '2026-10-20 12:00:00' }];
        if (sql.startsWith('INSERT INTO')) {
          events.push('profile-identity');
          return [];
        }
        if (sql.startsWith('SELECT authored')) {
          if (failSelect) throw new Error('db unavailable');
          return [];
        }
        return [];
      }),
    };
    const identities: any = {
      readIdentities: jest.fn(
        async (
          _g: unknown,
          _d: unknown,
          page: (ids: readonly string[]) => Promise<void>
        ) => page([profile])
      ),
    };
    const auth: any = { send: jest.fn(() => of({ valid: true })) };
    const sources = (table: string): SocialCaptureSource[] =>
      SOCIAL_AUTHORED_SOURCES.map((source) => ({
        source,
        sql: `SELECT authored FROM "${table}"`,
        project: (row) => row,
      }));
    const service = new SocialAccountExportOwnerService(
      { createQueryRunner: () => runner } as any,
      identities,
      auth
    );
    return { service, runner, identities, auth, events, sources };
  }

  it('validates lease, snapshots identities, and cleans the runner before emitting terminal completion', async () => {
    const { service, runner, identities, auth, events, sources } = setup();
    const chunks: any[] = [];
    const result = await service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      sources,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        if (chunk.complete) events.push('terminal');
      },
    });
    expect(result.complete).toBe(true);
    expect(identities.readIdentities).toHaveBeenCalledTimes(1);
    expect(auth.send).toHaveBeenCalled();
    expect(runner.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');
    expect(events.indexOf('drop-temp')).toBeLessThan(
      events.indexOf('terminal')
    );
    expect(events.indexOf('release')).toBeLessThan(events.indexOf('terminal'));
    expect(chunks.at(-1).checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses the full 33-source registry by default while allowing explicit fixture subsets', async () => {
    const { service, runner } = setup();
    const chunks: any[] = [];
    const terminal = await service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => chunks.push(chunk),
    });

    expect(terminal.complete).toBe(true);
    expect(Object.keys(terminal.sourceRowCounts)).toEqual(
      SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    expect(
      runner.query.mock.calls.filter(
        ([sql]: [string]) =>
          sql.startsWith('SELECT') && !sql.includes('transaction_timestamp')
      )
    ).toHaveLength(SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.length);
  });

  it('fails closed on source read errors and never emits complete', async () => {
    const { service, events, sources } = setup(true);
    const chunks: any[] = [];
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        sources,
        onChunk: async (chunk) => chunks.push(chunk),
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    expect(chunks.some((chunk) => chunk.complete)).toBe(false);
    expect(events).toContain('rollback');
  });

  it('aborts on lease loss and does not emit terminal completion', async () => {
    const { service, events, sources, auth } = setup();
    auth.send
      .mockReturnValueOnce(of({ valid: true }))
      .mockReturnValueOnce(of({ valid: false }));
    const chunks: any[] = [];
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        sources,
        onChunk: async (chunk) => chunks.push(chunk),
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(chunks.some((chunk) => chunk.complete)).toBe(false);
    expect(events).toContain('drop-temp');
    expect(events).toContain('release');
  });

  it('times out a stalled chunk consumer and cleans the transaction', async () => {
    const { service, events, sources } = setup();
    const chunks: any[] = [];
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        sources,
        captureTimeoutMs: 25,
        onChunk: async (chunk) => {
          chunks.push(chunk);
          return new Promise<void>(() => undefined);
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_TIMEOUT' });
    expect(chunks.some((chunk) => chunk.complete)).toBe(false);
    expect(events).toContain('rollback');
    expect(events).toContain('drop-temp');
    expect(events).toContain('release');
  });
});
