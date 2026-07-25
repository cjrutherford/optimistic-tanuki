import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnerAuthorizationService } from './owner-authorization.service';

describe('OwnerAuthorizationService', () => {
  const token = 'owner-token';
  let fetchMock: jest.Mock;
  let service: OwnerAuthorizationService;

  beforeEach(() => {
    fetchMock = jest.fn();
    service = new OwnerAuthorizationService(
      {
        get: jest.fn(
          (key: string) =>
            ({
              'admin-api.jwtSecret': 'test-secret',
              'admin-api.gatewayBaseUrl': 'http://gateway:3000',
            }[key])
        ),
      } as unknown as ConfigService,
      fetchMock as unknown as typeof fetch
    );
  });

  it('allows a verified token whose owner-console profile has the owner-console role', async () => {
    jest.spyOn(service, 'verifyToken').mockReturnValue({
      profileId: 'global-profile',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ role: { name: 'owner_console_owner' } }],
    });

    await expect(
      service.assertAuthorized(`Bearer ${token}`)
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/permissions/user-roles/global-profile?appScope=owner-console',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      })
    );
  });

  it('rejects a missing bearer token', async () => {
    await expect(service.assertAuthorized(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects a verified token without an owner-level role', async () => {
    jest.spyOn(service, 'verifyToken').mockReturnValue({
      profileId: 'global-profile',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ role: { name: 'member' } }],
    });

    await expect(
      service.assertAuthorized(`Bearer ${token}`)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
