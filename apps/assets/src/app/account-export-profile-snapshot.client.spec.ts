import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotIdentityPage,
} from '@optimistic-tanuki/models';
import { Observable, defer, of, throwError } from 'rxjs';
import { AssetsAccountExportProfileSnapshotClient } from './account-export-profile-snapshot.client';

const accountId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const leaseOwner = '33333333-3333-4333-8333-333333333333';
const captureId = '44444444-4444-4444-8444-444444444444';
const handleId = '55555555-5555-4555-8555-555555555555';
const grant: AccountExportCaptureGrant = {
  accountId,
  appId: 'client-interface',
  token: 'secret-token',
  jobId,
  attempt: 2,
  leaseOwner,
};
const descriptor: AccountExportSnapshotDescriptor = {
  handleId,
  participantId: 'profile',
  accountId,
  captureId,
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sources: [],
  sourceRowCounts: {},
  sourceDispositions: {},
  identityCount: 0,
  expiresAt: '2026-10-20T12:02:00.000Z',
};
const page = (
  offset: number,
  ids: string[],
  total: number
): AccountExportSnapshotIdentityPage => ({
  handleId,
  captureId,
  accountId,
  snapshotAt: descriptor.snapshotAt,
  profileIds: ids,
  total,
  nextOffset: offset + ids.length < total ? offset + ids.length : null,
});

describe('AssetsAccountExportProfileSnapshotClient', () => {
  let send: jest.Mock;
  let client: AssetsAccountExportProfileSnapshotClient;
  beforeEach(() => {
    jest.useRealTimers();
    send = jest.fn();
    client = new AssetsAccountExportProfileSnapshotClient({
      send,
    } as unknown as ClientProxy);
  });

  it('streams all identity pages in order and returns stable capture metadata', async () => {
    const ids = Array.from(
      { length: 1006 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    );
    send.mockImplementation((_pattern, request) => {
      const start = request.offset;
      return of(
        page(start, ids.slice(start, start + request.limit), ids.length)
      );
    });
    const seen: string[][] = [];
    const result = await client.readIdentities(
      grant,
      { ...descriptor, identityCount: ids.length },
      async (batch) => {
        seen.push([...batch]);
      }
    );
    expect(seen.flat()).toEqual(ids);
    expect(seen.map((x) => x.length)).toEqual([
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 6,
    ]);
    expect(result).toEqual({
      accountId,
      handleId,
      captureId,
      snapshotAt: descriptor.snapshotAt,
      identityCount: 1006,
    });
    expect(send).toHaveBeenCalledTimes(11);
    expect(send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.ReadAccountExportCaptureIdentities },
      expect.objectContaining({
        offset: 1000,
        limit: 100,
        handleId,
        token: 'secret-token',
      })
    );
  });

  it('accepts canonical zero UUID profile IDs', async () => {
    const zeroId = '00000000-0000-0000-0000-000000000000';
    send.mockReturnValue(of(page(0, [zeroId], 1)));
    const callback = jest.fn();
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 1 },
        callback
      )
    ).resolves.toMatchObject({ identityCount: 1 });
    expect(callback).toHaveBeenCalledWith([zeroId], expect.any(AbortSignal));
  });

  it('queries and validates one empty page', async () => {
    send.mockReturnValue(of(page(0, [], 0)));
    const callback = jest.fn();
    await expect(
      client.readIdentities(grant, descriptor, callback)
    ).resolves.toMatchObject({ identityCount: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each([
    ['account', { accountId: '66666666-6666-4666-8666-666666666666' }],
    ['capture', { captureId: '77777777-7777-4777-8777-777777777777' }],
    ['snapshot', { snapshotAt: '2026-10-20T12:01:00.000Z' }],
    ['total', { total: 2 }],
  ])(
    'rejects mismatched %s without emitting that page',
    async (_name, patch) => {
      send.mockReturnValue(
        of({
          ...page(0, ['00000000-0000-4000-8000-000000000001'], 1),
          ...patch,
        })
      );
      const callback = jest.fn();
      await expect(
        client.readIdentities(
          grant,
          { ...descriptor, identityCount: 1 },
          callback
        )
      ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_INVALID' });
      expect(callback).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      'duplicate cross page',
      [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
      ],
    ],
    [
      'out of order cross page',
      [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
      ],
    ],
  ])('rejects %s before emitting the invalid page', async (_name, ids) => {
    const firstPage = Array.from(
      { length: 100 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    );
    send
      .mockReturnValueOnce(of(page(0, firstPage, 101)))
      .mockReturnValueOnce(of(page(100, [ids[1]], 101)));
    const callback = jest.fn();
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 101 },
        callback
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_INVALID' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', []],
    [
      'extra',
      [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ],
    ],
  ])('rejects %s final-page rows', async (_name, ids) => {
    send.mockReturnValue(of(page(0, ids, 1)));
    const callback = jest.fn();
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 1 },
        callback
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_INVALID' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('rejects nested-array IDs before invoking the page callback', async () => {
    const nested = ['00000000-0000-4000-8000-000000000001'];
    send.mockReturnValue(
      of({ ...page(0, [], 1), profileIds: [nested] as unknown as string[] })
    );
    const callback = jest.fn();
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 1 },
        callback
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_INVALID' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('suppresses callback failure details', async () => {
    send.mockReturnValue(
      of(page(0, ['00000000-0000-4000-8000-000000000001'], 1))
    );
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 1 },
        async () => {
          throw new Error('private callback detail');
        }
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_UNAVAILABLE' });
  });

  it('rejects repeated and nonprogressing cursors', async () => {
    const repeated = {
      ...page(0, ['00000000-0000-4000-8000-000000000001'], 2),
      nextOffset: 0,
    };
    send.mockReturnValue(of(repeated));
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 2 },
        jest.fn()
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_INVALID' });
  });

  it('rejects transport failures with a stable code and no transport details', async () => {
    send.mockReturnValue(
      throwError(() => new Error('private transport detail'))
    );
    await expect(
      client.readIdentities(grant, descriptor, jest.fn())
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_UNAVAILABLE' });
  });

  it('propagates abort to callbacks and performs no subsequent callback', async () => {
    const abort = new AbortController();
    send.mockReturnValue(
      of(
        page(
          0,
          Array.from(
            { length: 100 },
            (_, i) =>
              `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
          ),
          101
        )
      )
    );
    const callback = jest.fn(
      async (_ids: readonly string[], signal: AbortSignal) => {
        abort.abort();
        expect(signal.aborted).toBe(true);
      }
    );
    await expect(
      client.readIdentities(
        grant,
        { ...descriptor, identityCount: 101 },
        callback,
        abort.signal
      )
    ).rejects.toMatchObject({ code: 'PROFILE_SNAPSHOT_ABORTED' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('enforces the whole-operation deadline and waits for a cooperative callback to stop', async () => {
    jest.useFakeTimers();
    send.mockReturnValue(
      of(page(0, ['00000000-0000-4000-8000-000000000001'], 1))
    );
    let callbackSignal!: AbortSignal;
    const callback = jest.fn((_ids: readonly string[], signal: AbortSignal) => {
      callbackSignal = signal;
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const result = client.readIdentities(
      grant,
      { ...descriptor, identityCount: 1 },
      callback
    );
    const settled = result.catch((error) => error);
    await jest.advanceTimersByTimeAsync(120_000);
    await expect(settled).resolves.toMatchObject({
      code: 'PROFILE_SNAPSHOT_TIMEOUT',
    });
    expect(callbackSignal.aborted).toBe(true);
    jest.useRealTimers();
  });

  it('times out a nonresponsive Profile RPC with a stable unavailable code', async () => {
    jest.useFakeTimers();
    send.mockReturnValue(new Observable(() => undefined));
    const result = client.readIdentities(
      grant,
      { ...descriptor, identityCount: 1 },
      jest.fn()
    );
    const settled = result.catch((error) => error);
    await jest.advanceTimersByTimeAsync(3000);
    await expect(settled).resolves.toMatchObject({
      code: 'PROFILE_SNAPSHOT_UNAVAILABLE',
    });
    jest.useRealTimers();
  });

  it('copies capability metadata before awaiting a page', async () => {
    let resolve!: (value: AccountExportSnapshotIdentityPage) => void;
    send.mockReturnValue(
      defer(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
    );
    const inputGrant = { ...grant };
    const inputDescriptor = { ...descriptor };
    const result = client.readIdentities(
      inputGrant,
      inputDescriptor,
      jest.fn()
    );
    inputGrant.accountId = '66666666-6666-4666-8666-666666666666';
    inputDescriptor.handleId = '77777777-7777-4777-8777-777777777777';
    resolve(page(0, [], 0));
    await expect(result).resolves.toMatchObject({ accountId, handleId });
    expect(send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.ReadAccountExportCaptureIdentities },
      expect.objectContaining({ accountId, handleId })
    );
  });
});
