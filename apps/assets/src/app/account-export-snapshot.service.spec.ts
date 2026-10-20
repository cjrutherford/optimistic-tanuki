import { of } from 'rxjs';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { AssetsAccountExportSnapshotService } from './account-export-snapshot.service';

const accountId = '11111111-1111-4111-8111-111111111111';
const grant = {
  accountId,
  appId: 'client-interface',
  token: 'secret-token',
  jobId: '22222222-2222-4222-8222-222222222222',
  attempt: 1,
  leaseOwner: '33333333-3333-4333-8333-333333333333',
};
const profileSnapshot = {
  handleId: '44444444-4444-4444-8444-444444444444',
  participantId: 'profile',
  accountId,
  captureId: '55555555-5555-4555-8555-555555555555',
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 0,
  sources: ['profileIdentity'],
  sourceRowCounts: { profileIdentity: 0 },
  sourceDispositions: { profileIdentity: 'no-retained-rows' },
  identityCount: 0,
  expiresAt: '2026-10-20T12:02:00.000Z',
};

describe('AssetsAccountExportSnapshotService', () => {
  let service: AssetsAccountExportSnapshotService;
  let owner: { captureAccount: jest.Mock };
  let auth: { send: jest.Mock };
  let spool: AccountExportOwnerSpoolService;

  const makeOwner = (gate?: Promise<void>) => ({
    captureAccount: jest.fn(async ({ onChunk, signal }: any) => {
      if (gate) await gate;
      const emitter = new AccountExportOwnerEmitter(
        {
          participantId: 'assets',
          accountId,
          captureId: '66666666-6666-4666-8666-666666666666',
          snapshotAt: '2026-10-20T12:00:00.000Z',
          sources: ['asset', 'assetMedia', 'guardianActivity'] as const,
          signal,
        },
        onChunk
      );
      await emitter.emitSources({
        asset: async function* () {},
        assetMedia: async function* () {},
        guardianActivity: async function* () {},
      });
      return emitter.complete();
    }),
  });

  beforeEach(() => {
    spool = new AccountExportOwnerSpoolService();
    owner = makeOwner();
    auth = { send: jest.fn(() => of({ valid: true })) };
    service = new AssetsAccountExportSnapshotService(
      owner as any,
      spool,
      auth as any
    );
  });

  it('opens a verified spool bound to parent metadata, supports canonical bounded reads, and releases by exact scope', async () => {
    const opened = await service.open({ ...grant, profileSnapshot });
    expect(opened).toMatchObject({
      participantId: 'assets',
      accountId,
      identityCount: 0,
      profileHandleId: profileSnapshot.handleId,
      profileCaptureId: profileSnapshot.captureId,
      profileSnapshotAt: profileSnapshot.snapshotAt,
    });
    expect(opened.sources).toEqual(['asset', 'assetMedia', 'guardianActivity']);
    expect(JSON.stringify(service)).not.toContain('secret-token');
    const first = await service.read({
      ...grant,
      handleId: opened.handleId,
      offset: 0,
      length: 64 * 1024,
    });
    expect(first.offset).toBe(0);
    expect(Buffer.from(first.bytesBase64, 'base64').length).toBe(
      opened.sizeBytes
    );
    expect(first.eof).toBe(true);
    await expect(
      service.read({
        ...grant,
        handleId: opened.handleId,
        offset: 0,
        length: 64 * 1024 + 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
    await expect(
      service.read({
        ...grant,
        appId: 'foreign',
        handleId: opened.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    auth.send.mockReturnValueOnce(of({ valid: false }));
    await expect(
      service.read({
        ...grant,
        handleId: opened.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(
      await service.release({ ...grant, handleId: opened.handleId })
    ).toEqual({ handleId: opened.handleId, released: true });
    await service.onModuleDestroy();
  });

  it('drains owner cleanup after abort before opening resolves and shutdown finishes', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    owner = makeOwner(gate);
    service = new AssetsAccountExportSnapshotService(
      owner as any,
      spool,
      auth as any
    );
    const opening = service.open({ ...grant, profileSnapshot });
    await new Promise((resolve) => setImmediate(resolve));
    const closing = service.onModuleDestroy();
    let settled = false;
    void opening
      .finally(() => {
        settled = true;
      })
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    finish();
    await expect(opening).rejects.toBeDefined();
    await closing;
  });

  it('rejects malformed parent metadata before capture', async () => {
    await expect(
      service.open({
        ...grant,
        profileSnapshot: { ...profileSnapshot, identityCount: -1 },
      })
    ).rejects.toBeDefined();
    expect(owner.captureAccount).not.toHaveBeenCalled();
  });

  it('enforces two pending or published captures and validates the lease after reads', async () => {
    const one = await service.open({ ...grant, profileSnapshot });
    const secondGrant = {
      ...grant,
      jobId: '77777777-7777-4777-8777-777777777777',
    };
    const two = await service.open({
      ...secondGrant,
      profileSnapshot,
    });
    await expect(
      service.open({
        ...grant,
        jobId: '88888888-8888-4888-8888-888888888888',
        profileSnapshot,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_CAPACITY' });
    auth.send.mockImplementation(() => of({ valid: true }));
    await service.read({
      ...grant,
      handleId: one.handleId,
      offset: 0,
      length: 1,
    });
    auth.send
      .mockImplementationOnce(() => of({ valid: true }))
      .mockImplementationOnce(() => of({ valid: false }));
    await expect(
      service.read({
        ...secondGrant,
        handleId: two.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    await service.onModuleDestroy();
  });

  it('expires a published snapshot, denies reads, and closes its spool handle', async () => {
    const opened = await service.open({ ...grant, profileSnapshot });
    const entry = (service as any).entries.get(opened.handleId);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 120_001);
    await expect(
      service.read({
        ...grant,
        handleId: opened.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_EXPIRED' });
    while (!entry.cleanupPromise) await Promise.resolve();
    await entry.cleanupPromise;
    expect((service as any).entries.has(opened.handleId)).toBe(false);
    await expect(entry.spool.readChunk(0, 1)).rejects.toMatchObject({
      code: 'OWNER_SPOOL_CLOSED',
    });
    jest.restoreAllMocks();
    await service.onModuleDestroy();
  });

  it('keeps failed post-capture cleanup inaccessible and charged against capacity', async () => {
    const realCapture = spool.capture.bind(spool);
    const failingSpool = {
      capture: async (...args: any[]) => {
        const handle = await realCapture(...args);
        handle.cleanup = jest.fn().mockRejectedValue(new Error('close failed'));
        return handle;
      },
    };
    auth.send
      .mockImplementationOnce(() => of({ valid: true }))
      .mockImplementationOnce(() => of({ valid: false }));
    service = new AssetsAccountExportSnapshotService(
      owner as any,
      failingSpool as any,
      auth as any
    );
    await expect(
      service.open({ ...grant, profileSnapshot })
    ).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CLEANUP_FAILED',
    });
    const retired = [...(service as any).entries.values()][0];
    expect(retired.retired).toBe(true);
    expect((service as any).reservedBytes).toBe(256 * 1024 * 1024);
    await expect(
      service.read({
        ...grant,
        handleId: retired.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_CLEANUP_FAILED' });
    await service.open({
      ...grant,
      jobId: '77777777-7777-4777-8777-777777777777',
      profileSnapshot,
    });
    await expect(
      service.open({
        ...grant,
        jobId: '88888888-8888-4888-8888-888888888888',
        profileSnapshot,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_CAPACITY' });
    await service.onModuleDestroy();
  });

  it('does not start an owner capture when shutdown happens during initial lease validation', async () => {
    let validate!: (value: { valid: boolean }) => void;
    auth.send.mockReturnValueOnce(
      new (require('rxjs').Observable)((subscriber: any) => {
        validate = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      })
    );
    const opening = service.open({ ...grant, profileSnapshot });
    await new Promise((resolve) => setImmediate(resolve));
    await service.onModuleDestroy();
    validate({ valid: true });
    await expect(opening).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CLOSED',
    });
    expect(owner.captureAccount).not.toHaveBeenCalled();
  });
});
