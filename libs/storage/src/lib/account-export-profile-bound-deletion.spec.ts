import { of } from 'rxjs';
import {
  AccountExportProfileBoundSnapshotService,
  ProfileBoundSnapshotOwner,
} from './account-export-profile-bound-snapshot.service';
import { AccountExportOwnerSpoolService } from './account-export-owner-spool.service';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const grant = (accountId: string) => ({
  accountId,
  appId: 'test',
  token: 'token',
  jobId: '33333333-3333-4333-8333-333333333333',
  attempt: 1,
  leaseOwner: '44444444-4444-4444-8444-444444444444',
});
const profile = (accountId: string) => ({
  participantId: 'profile',
  accountId,
  handleId: '55555555-5555-4555-8555-555555555555',
  captureId: '66666666-6666-4666-8666-666666666666',
  snapshotAt: new Date().toISOString(),
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sources: ['test'],
  sourceRowCounts: { test: 1 },
  sourceDispositions: { test: 'snapshot' },
  identityCount: 0,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});
const metadata = (accountId: string) => ({
  participantId: 'test',
  accountId,
  captureId: '77777777-7777-4777-8777-777777777777',
  snapshotAt: new Date().toISOString(),
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sourceRowCounts: { test: 1 },
  sourceDispositions: { test: 'snapshot' },
});

describe('profile bound account deletion drain', () => {
  let entries: Map<string, any>;
  let opens: Array<() => void>;
  let openStarted: () => void;
  let started: Promise<void>;
  let service: AccountExportProfileBoundSnapshotService<'test'>;
  let owner: ProfileBoundSnapshotOwner<'test'>;
  let spool: any;

  afterEach(async () => {
    await service?.onModuleDestroy();
  });

  const makeService = () => {
    entries = new Map();
    opens = [];
    started = new Promise<void>((resolve) => (openStarted = resolve));
    let n = 0;
    spool = {
      metadata: metadata(A),
      readChunk: jest.fn(async () => Buffer.from('x')),
      cleanup: jest.fn(async () => undefined),
    };
    owner = {
      captureAccount: jest.fn(async ({ signal, onChunk }: any) => {
        await new Promise<void>((resolve) => {
          opens.push(resolve);
          openStarted();
          signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        if (signal?.aborted) throw new Error('aborted');
        await onChunk({ source: 'test', rows: [], terminal: true } as any);
        return {} as any;
      }),
    };
    const spoolService = {
      capture: jest.fn(async (options: any, produce: any) => {
        const handle = { ...spool, metadata: metadata(options.accountId) };
        await produce(async () => undefined, options.signal);
        handle.cleanup = spool.cleanup;
        entries.set(options.accountId, handle);
        return handle;
      }),
    } as unknown as AccountExportOwnerSpoolService;
    const auth = { send: jest.fn(() => of({ valid: true })) } as any;
    service = new AccountExportProfileBoundSnapshotService(
      owner,
      spoolService,
      auth,
      {
        participantId: 'test',
        sources: ['test'],
      }
    );
  };

  const open = async (accountId: string) =>
    service.open({
      ...grant(accountId),
      profileSnapshot: profile(accountId),
    });

  it('purges only matching account entries and fences subsequent opens', async () => {
    makeService();
    const a = open(A);
    await started;
    const b = open(B);
    await new Promise<void>((resolve) => {
      const check = () => (opens.length > 1 ? resolve() : setTimeout(check, 0));
      check();
    });
    opens.splice(0).forEach((resolve) => resolve());
    const [aDescriptor, bDescriptor] = await Promise.all([a, b]);
    const before = (service as any).entries.get(bDescriptor.handleId);

    await expect(service.purgeAccount(A)).resolves.toEqual({ remaining: 0 });
    expect((service as any).entries.has(aDescriptor.handleId)).toBe(false);
    expect((service as any).entries.get(bDescriptor.handleId)).toBe(before);
    expect(spool.cleanup).toHaveBeenCalledTimes(1);
    await expect(open(A)).rejects.toMatchObject({
      code: 'OWNER_ACCOUNT_PURGED',
    });
  });

  it('aborts and drains a same-account open before reporting empty', async () => {
    makeService();
    const opening = open(A);
    await started;
    await expect(service.purgeAccount(A)).resolves.toEqual({ remaining: 0 });
    await expect(opening).rejects.toBeDefined();
    expect((service as any).opening.size).toBe(0);
  });

  it('waits for an active read and retains failed cleanup for retry', async () => {
    makeService();
    const pending = open(A);
    await started;
    opens.splice(0).forEach((resolve) => resolve());
    const descriptor = await pending;
    const entry = (service as any).entries.get(descriptor.handleId);
    let finishRead!: (value: Buffer) => void;
    let markRead!: () => void;
    const reading = new Promise<void>((resolve) => (markRead = resolve));
    entry.spool.readChunk = jest.fn(
      () =>
        new Promise<Buffer>((resolve) => {
          finishRead = resolve;
          markRead();
        })
    );
    const read = service.read({
      ...grant(A),
      handleId: descriptor.handleId,
      offset: 0,
      length: 1,
    });
    await reading;
    spool.cleanup
      .mockRejectedValueOnce(new Error('cleanup fail'))
      .mockRejectedValueOnce(new Error('cleanup fail again'))
      .mockResolvedValueOnce(undefined);
    const purge = service.purgeAccount(A);
    await Promise.resolve();
    expect(spool.cleanup).not.toHaveBeenCalled();
    finishRead(Buffer.from('x'));
    await expect(read).rejects.toBeDefined();
    // The first remove attempt makes the failure visible; the retained entry is retryable.
    await expect(purge).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CLEANUP_FAILED',
    });
    await expect(service.purgeAccount(A)).resolves.toEqual({ remaining: 0 });
  });
  it('rejects nil and noncanonical account identities before installing a purge fence', async () => {
    makeService();
    for (const id of [
      '00000000-0000-0000-0000-000000000000',
      'not-an-account',
      A + ' ',
    ])
      await expect(service.purgeAccount(id)).rejects.toBeDefined();
    expect((service as any).purgedAccounts.size).toBe(0);
  });
});
