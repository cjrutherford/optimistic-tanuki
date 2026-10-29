import { Repository } from 'typeorm';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';
import { AccountDeletionFenceService } from './account-deletion-fence.service';

const account = '123e4567-e89b-42d3-a456-426614174000';
describe('permanent account deletion fence', () => {
  const existsBy = jest.fn();
  const service = new AccountDeletionFenceService({
    existsBy,
  } as unknown as Repository<AccountDeletionOperationEntity>);
  beforeEach(() => existsBy.mockReset());
  it('uses an account-wide canonical hash without retaining raw identity in lookup', async () => {
    existsBy.mockResolvedValue(false);
    await service.assertActiveAccount(account.toUpperCase());
    expect(existsBy).toHaveBeenCalledWith({
      fenceKey: deletionIdentityKey('account', account),
    });
  });
  it('denies any persisted operation, including terminal deletion', async () => {
    existsBy.mockResolvedValue(true);
    await expect(service.assertActiveAccount(account)).rejects.toThrow(
      'ACCOUNT_DELETION_FENCED'
    );
  });
  it('propagates unavailable authority instead of granting access', async () => {
    existsBy.mockRejectedValue(new Error('database unavailable'));
    await expect(service.assertActiveAccount(account)).rejects.toThrow(
      'database unavailable'
    );
  });
});
