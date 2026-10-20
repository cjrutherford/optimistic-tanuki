import { of } from 'rxjs';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { VideosAccountExportSnapshotService } from './account-export-snapshot.service';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grant = {
  accountId,
  appId: 'videos',
  token: 'secret-token',
  jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  attempt: 1,
  leaseOwner: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const profileSnapshot = {
  handleId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  participantId: 'profile',
  accountId,
  captureId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sources: ['profileIdentity'],
  sourceRowCounts: { profileIdentity: 1 },
  sourceDispositions: { profileIdentity: 'retained' },
  identityCount: 1,
  expiresAt: '2026-10-20T12:02:00.000Z',
};

describe('VideosAccountExportSnapshotService', () => {
  it('spools all seven source proofs with parent binding, enforces grant scope and rechecks the lease', async () => {
    const spool = new AccountExportOwnerSpoolService();
    const auth = { send: jest.fn(() => of({ valid: true })) };
    const owner = {
      captureAccount: jest.fn(async ({ onChunk, signal }: any) => {
        const emitter = new AccountExportOwnerEmitter(
          {
            participantId: 'videos',
            accountId,
            captureId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            snapshotAt: '2026-10-20T12:00:00.000Z',
            sources: VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
            signal,
          },
          onChunk
        );
        await emitter.emitSources(
          Object.fromEntries(
            VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
              source,
              async function* () {},
            ])
          ) as any
        );
        return emitter.complete();
      }),
    };
    const service = new VideosAccountExportSnapshotService(
      owner as any,
      spool,
      auth as any
    );
    const opened = await service.open({ ...grant, profileSnapshot });
    expect(opened.participantId).toBe('videos');
    expect(opened.sources).toEqual(VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES);
    expect(opened).toMatchObject({
      profileHandleId: profileSnapshot.handleId,
      profileCaptureId: profileSnapshot.captureId,
      profileSnapshotAt: profileSnapshot.snapshotAt,
    });
    await expect(
      service.read({
        ...grant,
        appId: 'other',
        handleId: opened.handleId,
        offset: 0,
        length: 0,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    auth.send.mockImplementation(() => of({ valid: false }));
    await expect(
      service.read({
        ...grant,
        handleId: opened.handleId,
        offset: 0,
        length: 0,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(owner.captureAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        profileSnapshot: expect.objectContaining({
          captureId: profileSnapshot.captureId,
        }),
      })
    );
    await service.release({ ...grant, handleId: opened.handleId });
    await service.onModuleDestroy();
  });
});
