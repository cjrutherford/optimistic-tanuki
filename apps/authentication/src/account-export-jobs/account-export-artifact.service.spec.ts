import { Readable } from 'node:stream';
import { AccountExportArtifactBuilderService } from '@optimistic-tanuki/storage';
import { AccountExportArtifactService } from './account-export-artifact.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';

const claimBase = (): AccountExportJobEntity =>
  Object.assign(new AccountExportJobEntity(), {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    appId: 'client-interface',
    attempt: 1,
    leaseOwner: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    state: 'running',
    leaseExpiresAt: new Date(Date.now() + 60_000),
    coverageSummary: { sourceSummary: { captured: true } },
  });

const repoHarness = () => {
  const updates: Array<Record<string, unknown>> = [];
  const jobs = {
    query: jest.fn().mockResolvedValue([{ count: 0 }]),
    createQueryBuilder: jest.fn(() => {
      const builder: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn((v) => {
          builder.values = v;
          return builder;
        }),
        where: jest.fn((clause, params) => {
          builder.clause = clause;
          builder.params = params;
          return builder;
        }),
        execute: jest.fn(async () => {
          updates.push(builder.values);
          return { affected: 1 };
        }),
      };
      return builder;
    }),
  };
  return { jobs: jobs as any, updates };
};

const fakeHandle = () => ({
  metadata: { sizeBytes: 3, sha256: 'a'.repeat(64) },
  createReadStream: () => Readable.from([Buffer.from('tar')]),
  cleanup: jest.fn().mockResolvedValue(undefined),
});

describe('AccountExportArtifactService', () => {
  it('persists private intent before encrypted bytes and returns verified but unpublished summary', async () => {
    const { jobs, updates } = repoHarness();
    const handle = fakeHandle();
    const builder = {
      build: jest.fn().mockResolvedValue(handle),
    } as unknown as AccountExportArtifactBuilderService;
    const store = {
      put: jest.fn(async (input) => {
        expect(updates[0].coverageSummary).toMatchObject({
          artifactState: 'assembling',
          artifactAvailable: false,
        });
        expect(input.assertCurrent()).resolves.toBe(true);
        return {
          ...input,
          stream: undefined,
          frameCount: 1,
          framingVersion: 1 as const,
        };
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AccountExportArtifactService(jobs, builder, store);
    const result = await service.prepare({
      claim: claimBase(),
      handles: [],
      summary: { sourceSummary: { captured: true } },
      renewLease: async () => true,
    });
    expect(builder.build).toHaveBeenCalledWith(
      expect.objectContaining({ expectedSourcesByOwner: expect.any(Object) })
    );
    expect(store.put).toHaveBeenCalledTimes(1);
    expect(result.summary).toMatchObject({
      artifactState: 'verified',
      artifactAvailable: false,
      sourceSummary: { captured: true },
    });
    expect(result.summary.privateArtifact).toEqual(result.descriptor);
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not write bytes if the database lease CAS loses', async () => {
    const { jobs } = repoHarness();
    jobs.createQueryBuilder = jest.fn(() => ({
      update: () => ({
        set: () => ({
          where: () => ({ execute: async () => ({ affected: 0 }) }),
        }),
      }),
    }));
    const handle = fakeHandle();
    const store = { put: jest.fn(), remove: jest.fn() } as any;
    const service = new AccountExportArtifactService(
      jobs,
      { build: async () => handle } as any,
      store
    );
    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_LEASE_LOST');
    expect(store.put).not.toHaveBeenCalled();
    expect(handle.cleanup).toHaveBeenCalled();
  });

  it('compensates bytes and clears its intent after lease loss during storage', async () => {
    const { jobs, updates } = repoHarness();
    const handle = fakeHandle();
    let renewals = 0;
    const store = {
      put: jest.fn(async () => {
        throw new Error('ARTIFACT_LEASE_LOST');
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AccountExportArtifactService(
      jobs,
      { build: async () => handle } as any,
      store
    );
    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => ++renewals < 4,
      })
    ).rejects.toThrow('ARTIFACT_LEASE_LOST');
    expect(store.put).toHaveBeenCalledTimes(1);
    expect(store.remove).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: claimBase().id }),
      expect.any(Function)
    );
    expect(jobs.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('retains private intent when removing failed storage rejects', async () => {
    const { jobs, updates } = repoHarness();
    const handle = fakeHandle();
    const store = {
      put: jest.fn().mockRejectedValue(new Error('storage write failed')),
      remove: jest.fn().mockRejectedValue(new Error('storage cleanup failed')),
    } as any;
    const service = new AccountExportArtifactService(
      jobs,
      { build: async () => handle } as any,
      store
    );

    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_CLEANUP_FAILED');

    expect(store.remove).toHaveBeenCalledTimes(1);
    expect(jobs.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(updates[0].coverageSummary).toMatchObject({
      artifactState: 'assembling',
      artifactAvailable: false,
      privateArtifact: expect.objectContaining({ jobId: claimBase().id }),
    });
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
  });

  it('compensates stored bytes when built-handle cleanup fails', async () => {
    const { jobs } = repoHarness();
    const handle = fakeHandle();
    handle.cleanup.mockRejectedValue(new Error('spool cleanup failed'));
    const store = {
      put: jest.fn(async (input) => ({
        ...input,
        stream: undefined,
        frameCount: 1,
        framingVersion: 1 as const,
      })),
      remove: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AccountExportArtifactService(
      jobs,
      { build: async () => handle } as any,
      store
    );

    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_CLEANUP_FAILED');

    expect(store.put).toHaveBeenCalledTimes(1);
    expect(store.remove).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: claimBase().id }),
      expect.any(Function)
    );
  });

  it('fails closed on account quota before building', async () => {
    const { jobs } = repoHarness();
    jobs.query.mockResolvedValue([{ count: '2' }]);
    const builder = { build: jest.fn() } as any;
    const service = new AccountExportArtifactService(jobs, builder, {} as any);
    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_ACCOUNT_QUOTA_EXCEEDED');
    expect(builder.build).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [] },
    { rows: [{ count: 'not-a-count' }] },
    { rows: [{ count: '-1' }] },
  ])(
    'fails closed on invalid quota response %j before building',
    async ({ rows }) => {
      const { jobs } = repoHarness();
      jobs.query.mockResolvedValue(rows);
      const builder = { build: jest.fn() } as any;
      const service = new AccountExportArtifactService(
        jobs,
        builder,
        {} as any
      );

      await expect(
        service.prepare({
          claim: claimBase(),
          handles: [],
          summary: {},
          renewLease: async () => true,
        })
      ).rejects.toThrow('ARTIFACT_QUOTA_READ_FAILED');
      expect(builder.build).not.toHaveBeenCalled();
    }
  );

  it('rejects recovery metadata bound to a different account before removal', async () => {
    const claim = claimBase();
    claim.coverageSummary.privateArtifact = {
      artifactId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      jobId: claim.id,
      accountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      appId: claim.appId,
      attempt: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      frameCount: 1,
      framingVersion: 1 as const,
    };
    const store = { remove: jest.fn() } as any;
    const service = new AccountExportArtifactService(
      {} as any,
      {} as any,
      store
    );
    await expect(service.recover(claim, async () => true)).rejects.toThrow(
      'ARTIFACT_CONTEXT_MISMATCH'
    );
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('rejects discard metadata from another attempt before removal', async () => {
    const claim = claimBase();
    const descriptor = {
      artifactId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      jobId: claim.id,
      accountId: claim.accountId,
      appId: claim.appId,
      attempt: claim.attempt + 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      frameCount: 1,
      framingVersion: 1 as const,
    };
    const store = { remove: jest.fn() } as any;
    const service = new AccountExportArtifactService(
      {} as any,
      {} as any,
      store
    );

    await expect(service.discard(claim, descriptor)).rejects.toThrow(
      'ARTIFACT_CONTEXT_MISMATCH'
    );
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('surfaces cleanup failures with a stable code', async () => {
    const { jobs } = repoHarness();
    const handle = fakeHandle();
    handle.cleanup.mockRejectedValue(new Error('disk failure'));
    const service = new AccountExportArtifactService(
      jobs,
      { build: async () => handle } as any,
      { put: jest.fn() } as any
    );
    await expect(
      service.prepare({
        claim: claimBase(),
        handles: [],
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_CLEANUP_FAILED');
  });
});
