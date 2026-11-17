import { CommunityService } from './community.service';
import * as authority from './social-authority';

afterEach(() => jest.restoreAllMocks());

it('rejects a missing expected epoch before attempting a directory read', async () => {
  const repo = { manager: { transaction: jest.fn() } };
  const service = new CommunityService(repo as any, null as any, null as any, null as any, null as any, null as any, null as any);
  await expect(service.directorySnapshot('00000000-0000-4000-8000-000000000001', undefined as any)).rejects.toThrow('epoch');
  expect(repo.manager.transaction).not.toHaveBeenCalled();
});

it('rejects a mismatched nonce and excludes event identity from the private snapshot', async () => {
  const epoch = '11111111-1111-4111-8111-111111111111';
  const nonce = '22222222-2222-4222-8222-222222222222';
  const id = '33333333-3333-4333-8333-333333333333';
  jest.spyOn(authority, 'trustedDirectoryRuntimeEpochs').mockReturnValue({sourceEpoch: epoch, recoveryEpoch: epoch});
  const manager = { queryRunner: { isTransactionActive: true }, query: jest.fn().mockResolvedValueOnce([{ sourceEpoch: epoch, directoryRecoveryEpoch: epoch, fenced: false, phase: 'active', activationId: epoch, owner: epoch, socialGeneration: '1', directoryGeneration: '1', preparedPayload: { accepted: { version: 'directory-enabled-v1', digest: 'a'.repeat(64) } } }]).mockResolvedValueOnce([{ eventCommunityId: id, eventSourceEpoch: epoch, eventNonce: nonce, id: null, name: null, slug: null, adminArea: null, appScope: null, isPrivate: null, localityType: null }]) };
  const repo = { manager: { transaction: async (fn: any) => fn(manager) } };
  const service = new CommunityService(repo as any, null as any, null as any, null as any, null as any, null as any, null as any);
  expect(await service.directoryMembership('1', id, epoch, nonce)).toEqual({ status: 'pending', eventNonce: nonce, sourceEpoch: epoch, snapshot: null });
  manager.query.mockResolvedValueOnce([{ sourceEpoch: epoch, directoryRecoveryEpoch: epoch, fenced: false, phase: 'active', activationId: epoch, owner: epoch, socialGeneration: '1', directoryGeneration: '1', preparedPayload: { accepted: { version: 'directory-enabled-v1', digest: 'a'.repeat(64) } } }]).mockResolvedValueOnce([{ eventCommunityId: id, eventSourceEpoch: epoch, eventNonce: nonce, id: null }]);
  await expect(service.directoryMembership('1', id, epoch, id)).rejects.toThrow('collision');
  expect(manager.query).toHaveBeenCalledTimes(4);
});
