import { of } from 'rxjs';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { VideosAccountExportOwnerService } from './account-export-owner.service';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const min = '00000000-0000-0000-0000-000000000000';
const grant: any = {
  accountId: account,
  appId: 'videos',
  token: 'private',
  jobId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  attempt: 1,
  leaseOwner: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};
const descriptor: any = {
  participantId: 'profile',
  accountId: account,
  captureId: profile,
  handleId: profile,
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

describe('VideosAccountExportOwnerService', () => {
  function setup(
    options: {
      failDrop?: boolean;
      leaseValid?: boolean;
      oversize?: boolean;
      liveRow?: Record<string, unknown>;
    } = {}
  ) {
    const events: string[] = [];
    const runner: any = {
      connect: jest.fn(async () => events.push('connect')),
      startTransaction: jest.fn(async () => events.push('begin')),
      commitTransaction: jest.fn(async () => events.push('commit')),
      rollbackTransaction: jest.fn(async () => events.push('rollback')),
      release: jest.fn(async () => events.push('release')),
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('CREATE TEMP')) {
          events.push('create-temp');
          return [];
        }
        if (sql.startsWith('DROP TABLE')) {
          events.push('drop');
          if (options.failDrop) throw new Error('raw database detail');
          return [];
        }
        if (sql.includes('transaction_timestamp'))
          return [{ snapshotAt: '2026-10-20 12:00:00+00' }];
        if (sql.startsWith('SELECT 1 FROM')) return [{ '?column?': 1 }];
        if (sql.includes('FROM "live_session"'))
          return options.liveRow ? [options.liveRow] : [];
        if (sql.includes('FROM "channel" c'))
          return [
            {
              id: min,
              name: 'My channel',
              nameLength: options.oversize ? 201 : 10,
              description: null,
              descriptionLength: null,
              profileId: profile.toUpperCase(),
              profileIdLength: 36,
              userId: account.toUpperCase(),
              userIdLength: 36,
              communityId: 'community-safe',
              communityIdLength: 14,
              communitySlug: 'secret-slug',
              communitySlugLength: 12,
              joinPolicy: 'secret',
              joinPolicyLength: 6,
              appScope: 'secret',
              appScopeLength: 6,
              memberCount: 99,
              isPublic: true,
              timezone: null,
              timezoneLength: null,
              bannerAssetId: null,
              avatarAssetId: null,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ];
        return [];
      }),
      releasePostgresConnection: jest.fn(async () => events.push('evict')),
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
    const auth: any = {
      send: jest.fn(() => of({ valid: options.leaseValid ?? true })),
    };
    const svc = new VideosAccountExportOwnerService(
      { createQueryRunner: () => runner } as any,
      identities,
      auth
    );
    return { svc, runner, identities, auth, events };
  }

  it('emits the minimum UUID, omits private channel fields, and completes after release', async () => {
    const x = setup();
    const chunks: any[] = [];
    const end = await x.svc.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        x.events.push(chunk.source === 'end' ? 'terminal' : 'chunk');
      },
    });
    const channel = chunks.find((c) => c.source === 'channel').records[0].data;
    expect(channel.id).toBe(min);
    expect(channel.profileId).toBe(profile);
    expect(channel.communitySlug).toBe('secret-slug');
    expect(channel.memberCount).toBe(99);
    expect(x.events.indexOf('release')).toBeLessThan(
      x.events.indexOf('terminal')
    );
    expect(end.complete).toBe(true);
    expect(x.auth.send).toHaveBeenCalled();
    const ownerQueries = x.runner.query.mock.calls.map(
      ([sql]: [string]) => sql
    );
    expect(
      ownerQueries.some(
        (sql: string) =>
          sql.includes('lower(c."userId")=$1') &&
          sql.includes('lower(c."profileId") IN')
      )
    ).toBe(true);
  });

  it('sanitizes cleanup errors and quarantines a dirty query runner', async () => {
    const x = setup({ failDrop: true });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    expect(x.runner.releasePostgresConnection).toHaveBeenCalled();
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
  });

  it('fails closed when either creator identity on a live session contradicts the account', async () => {
    const x = setup({
      liveRow: {
        id: min,
        communityId: 'c',
        channelId: null,
        title: 'safe',
        titleLength: 4,
        description: null,
        descriptionLength: null,
        status: 'ended',
        startedAt: '2026-01-01',
        endedAt: '2026-01-02',
        thumbnailAssetId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        startedByUserId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        startedByProfileId: profile,
        channelCommunityId: null,
      },
    });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
  });

  it('rejects an expired lease and does not start database capture', async () => {
    const x = setup({ leaseValid: false });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(x.runner.connect).not.toHaveBeenCalled();
  });

  it('fails closed on an oversized operational text projection', async () => {
    const x = setup({ oversize: true });
    await expect(
      x.svc.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });
  });
});
