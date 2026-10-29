import { AuthCommands } from '@optimistic-tanuki/constants';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { of, throwError } from 'rxjs';
import { ProfileAccountExportOwnerService } from './account-export-owner.service';

jest.mock('uuid', () => ({
  v4: () => require('node:crypto').randomUUID(),
}));

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';

describe('ProfileAccountExportOwnerService authorization boundary', () => {
  const dataSource = { createQueryRunner: jest.fn() };
  const auth = { send: jest.fn() };
  let service: ProfileAccountExportOwnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileAccountExportOwnerService(
      dataSource as unknown as DataSource,
      auth as unknown as ClientProxy
    );
  });

  const options = () => ({
    accountId: ACCOUNT_ID,
    sessionToken: 'valid-session-token',
    appId: 'client-interface',
    onChunk: jest.fn(async () => undefined),
  });

  it('rejects malformed subject or missing capture fields before Auth RPC or database access', async () => {
    await expect(
      service.captureAccount({ ...options(), accountId: 'bad-id' })
    ).rejects.toMatchObject({ code: 'OWNER_ACCOUNT_MISMATCH' });
    await expect(
      service.captureAccount({ ...options(), appId: '' })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(auth.send).not.toHaveBeenCalled();
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('requires fresh Auth validation to confirm the exact account and app before opening a transaction', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: ACCOUNT_ID, appId: 'other-app' } })
    );
    await expect(service.captureAccount(options())).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    expect(auth.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      {
        token: 'valid-session-token',
        userId: ACCOUNT_ID,
        appId: 'client-interface',
      }
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    auth.send.mockReturnValue(
      of({
        isValid: true,
        data: {
          userId: 'f1384460-a162-49d4-89a0-5f7a07d8bd06',
          appId: 'client-interface',
        },
      })
    );
    await expect(service.captureAccount(options())).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    auth.send.mockReturnValue(
      of({ isValid: true, data: { appId: 'client-interface' } })
    );
    await expect(service.captureAccount(options())).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('fails closed when Auth RPC is revoked or unavailable', async () => {
    auth.send.mockReturnValue(
      of({ isValid: false, data: { userId: ACCOUNT_ID } })
    );
    await expect(service.captureAccount(options())).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    auth.send.mockReturnValue(
      throwError(() => new Error('private auth detail'))
    );
    await expect(service.captureAccount(options())).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
