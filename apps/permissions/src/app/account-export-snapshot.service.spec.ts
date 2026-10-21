import { of } from 'rxjs';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

import { PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { PermissionsAccountExportSnapshotService } from './account-export-snapshot.service';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grant = {
  accountId,
  appId: 'client-interface',
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

describe('PermissionsAccountExportSnapshotService', () => {
  it('binds the captured parent, verifies both source proofs, and fences handle scope', async () => {
    const spool = new AccountExportOwnerSpoolService();
    const auth = { send: jest.fn(() => of({ valid: true })) };
    const owner = {
      captureAccount: jest.fn(async ({ onChunk, signal }: any) => {
        const emitter = new AccountExportOwnerEmitter(
          {
            participantId: 'permissions',
            accountId,
            captureId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            snapshotAt: '2026-10-20T12:00:00.000Z',
            sources: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
            signal,
          },
          onChunk
        );
        await emitter.emitSources({
          roleAssignment: async function* () {
            yield {
              source: 'roleAssignment',
              data: {
                id: '00000000-0000-0000-0000-000000000001',
                profileId: '11111111-1111-4111-8111-111111111111',
              },
            };
          },
          rolePermission: async function* () {
            yield {
              source: 'rolePermission',
              data: {
                id: '22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333',
                roleId: '22222222-2222-4222-8222-222222222222',
                permissionId: '33333333-3333-4333-8333-333333333333',
              },
            };
          },
        });
        return emitter.complete();
      }),
    };
    const service = new PermissionsAccountExportSnapshotService(
      owner as any,
      spool,
      auth as any
    );

    await expect(
      service.open({
        ...grant,
        profileSnapshot: {
          ...profileSnapshot,
          accountId: '99999999-9999-4999-8999-999999999999',
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(owner.captureAccount).not.toHaveBeenCalled();

    const opened = await service.open({ ...grant, profileSnapshot });
    expect(opened).toMatchObject({
      participantId: 'permissions',
      sources: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      sourceRowCounts: { roleAssignment: 1, rolePermission: 1 },
      profileHandleId: profileSnapshot.handleId,
      profileCaptureId: profileSnapshot.captureId,
      profileSnapshotAt: profileSnapshot.snapshotAt,
    });

    const read = await service.read({
      ...grant,
      handleId: opened.handleId,
      offset: 0,
      length: opened.sizeBytes,
    });
    expect(read.eof).toBe(true);
    const chunks = Buffer.from(read.bytesBase64, 'base64')
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(chunks.map((chunk) => chunk.source)).toEqual([
      ...PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      'end',
    ]);
    expect(JSON.stringify(chunks)).toContain('roleAssignment');
    expect(JSON.stringify(chunks)).toContain('rolePermission');

    await expect(
      service.read({
        ...grant,
        appId: 'other-app',
        handleId: opened.handleId,
        offset: 0,
        length: 0,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    await service.release({ ...grant, handleId: opened.handleId });
    await service.onModuleDestroy();
  });
});
