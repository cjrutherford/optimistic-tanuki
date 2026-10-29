import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { GatewayNotificationRecipientService } from './gateway-notification-recipient.service';

describe('GatewayNotificationRecipientService', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const profileId = '22222222-2222-4222-8222-222222222222';
  let send: jest.Mock;
  let service: GatewayNotificationRecipientService;

  beforeEach(() => {
    send = jest.fn().mockReturnValue(of({ accountId, profileId, owned: true }));
    service = new GatewayNotificationRecipientService({ send } as never);
  });

  it('returns the canonical selected profile after exact ownership confirmation', async () => {
    await expect(
      service.assertSelected({ userId: accountId, profileId }, profileId)
    ).resolves.toBe(profileId);
    expect(send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.CheckAccountProfileOwnership },
      { accountId, profileId }
    );
  });

  it('canonicalizes uppercase principal and requested UUIDs before ownership checks', async () => {
    await expect(
      service.assertSelected(
        { userId: accountId.toUpperCase(), profileId: profileId.toUpperCase() },
        profileId.toUpperCase()
      )
    ).resolves.toBe(profileId);
    expect(send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.CheckAccountProfileOwnership },
      { accountId, profileId }
    );
  });

  it('rejects missing and malformed principals before RPC', async () => {
    await expect(
      service.assertSelected({ userId: accountId } as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.assertSelected({ userId: 'account', profileId })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a foreign selected profile before RPC', async () => {
    await expect(
      service.assertSelected(
        { userId: accountId, profileId },
        '33333333-3333-4333-8333-333333333333'
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('denies stale/unowned profiles and fails closed on malformed or unavailable replies', async () => {
    send.mockReturnValueOnce(of({ accountId, profileId, owned: false }));
    await expect(
      service.assertSelected({ userId: accountId, profileId })
    ).rejects.toBeInstanceOf(ForbiddenException);
    send.mockReturnValueOnce(
      of({ accountId, profileId, owned: true, extra: true })
    );
    await expect(
      service.assertSelected({ userId: accountId, profileId })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    send.mockReturnValueOnce(throwError(() => new Error('offline')));
    await expect(
      service.assertSelected({ userId: accountId, profileId })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
