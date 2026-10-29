import { AccountDeletionController } from './account-deletion.controller';
import { AppService } from '../app/app.service';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';

describe('deletion request identity boundary', () => {
  const validateToken = jest.fn();
  const accept = jest.fn();
  const status = jest.fn();
  const controller = new AccountDeletionController(
    { validateToken } as unknown as AppService,
    { accept, status } as unknown as AccountDeletionAuthorityService
  );
  beforeEach(() => {
    jest.resetAllMocks();
  });
  const request = {
    token: 'session',
    appId: 'client-interface',
    idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
    confirmation: 'delete-account',
  };
  it('takes the deleting identity solely from the validated scoped session', async () => {
    validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: 'own-account', appId: request.appId },
    });
    accept.mockResolvedValue({ id: 'operation' });
    status.mockResolvedValue({ state: 'fencing' });
    expect(await controller.create(request)).toEqual({ state: 'fencing' });
    expect(accept).toHaveBeenCalledWith(
      'own-account',
      request.appId,
      request.idempotencyKey
    );
  });
  it('rejects supplied account identity or missing confirmation before accepting anything', async () => {
    await expect(
      controller.create({ ...request, accountId: 'foreign' })
    ).rejects.toThrow('ACCOUNT_DELETION_REQUEST_INVALID');
    await expect(
      controller.create({ ...request, confirmation: undefined })
    ).rejects.toThrow('ACCOUNT_DELETION_REQUEST_INVALID');
    expect(accept).not.toHaveBeenCalled();
  });
  it('rejects cross-app and invalid sessions', async () => {
    validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: 'own-account', appId: 'local-hub' },
    });
    await expect(controller.create(request)).rejects.toThrow(
      'ACCOUNT_DELETION_SESSION_INVALID'
    );
    expect(accept).not.toHaveBeenCalled();
  });
});
