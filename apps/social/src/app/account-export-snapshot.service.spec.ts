jest.mock('@optimistic-tanuki/storage', () => {
  const spool = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-owner-spool.service'
  );
  const emitter = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-owner-emitter'
  );
  const bound = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-profile-bound-snapshot.service'
  );
  return {
    AccountExportOwnerSpoolService: spool.AccountExportOwnerSpoolService,
    AccountExportOwnerEmitter: emitter.AccountExportOwnerEmitter,
    AccountExportProfileBoundSnapshotService:
      bound.AccountExportProfileBoundSnapshotService,
    AccountExportProfileBoundSnapshotError:
      bound.AccountExportProfileBoundSnapshotError,
    AccountExportProfileSnapshotClient: class {},
  };
});

import { of } from 'rxjs';
import { SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { SocialAccountExportOwnerService } from './account-export-owner.service';
import { SocialAccountExportSnapshotService } from './account-export-snapshot.service';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grant = {
  accountId,
  appId: 'client-interface',
  token: 'synthetic-lease-token',
  jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  attempt: 1,
  leaseOwner: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const profileSnapshot = {
  handleId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  participantId: 'profile',
  accountId,
  captureId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  snapshotAt: '2026-10-21T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sources: ['profileIdentity'],
  sourceRowCounts: { profileIdentity: 1 },
  sourceDispositions: { profileIdentity: 'retained' },
  identityCount: 1,
  expiresAt: '2026-10-21T12:02:00.000Z',
};

describe('SocialAccountExportSnapshotService', () => {
  it('binds the profile snapshot and captures the full Social source registry', async () => {
    const spool = new AccountExportOwnerSpoolService();
    const auth = { send: jest.fn(() => of({ valid: true })) };
    const owner = {
      captureAccount: jest.fn(async ({ onChunk, signal }: any) => {
        const emitter = new AccountExportOwnerEmitter(
          {
            participantId: 'social',
            accountId,
            captureId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            snapshotAt: profileSnapshot.snapshotAt,
            sources: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
            signal,
          },
          onChunk
        );
        const emptySources = Object.fromEntries(
          SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
            source,
            async function* () {},
          ])
        );
        await emitter.emitSources(emptySources);
        return emitter.complete();
      }),
    };
    const service = new SocialAccountExportSnapshotService(
      owner as unknown as SocialAccountExportOwnerService,
      spool,
      auth as any
    );

    const opened = await service.open({ ...grant, profileSnapshot });
    expect(opened).toMatchObject({
      participantId: 'social',
      sources: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      sourceRowCounts: Object.fromEntries(
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [source, 0])
      ),
      profileHandleId: profileSnapshot.handleId,
      profileCaptureId: profileSnapshot.captureId,
      profileSnapshotAt: profileSnapshot.snapshotAt,
    });

    const result = await service.read({
      ...grant,
      handleId: opened.handleId,
      offset: 0,
      length: opened.sizeBytes,
    });
    const chunks = Buffer.from(result.bytesBase64, 'base64')
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(chunks.map((chunk) => chunk.source)).toEqual([
      ...SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      'end',
    ]);
    expect(result.eof).toBe(true);

    await expect(
      service.open({
        ...grant,
        profileSnapshot: {
          ...profileSnapshot,
          accountId: '99999999-9999-4999-8999-999999999999',
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    await service.release({ ...grant, handleId: opened.handleId });
    await service.onModuleDestroy();
    expect(auth.send).toHaveBeenCalledWith(
      { cmd: expect.any(String) },
      expect.objectContaining({ accountId, jobId: grant.jobId })
    );
    expect(owner.captureAccount).toHaveBeenCalledTimes(1);
  });
});
