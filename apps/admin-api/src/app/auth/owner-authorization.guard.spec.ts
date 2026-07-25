import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { OwnerAuthorizationGuard } from './owner-authorization.guard';
import { OwnerAuthorizationService } from './owner-authorization.service';

describe('OwnerAuthorizationGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const authorization = {
    assertAuthorized: jest.fn(),
  } as unknown as OwnerAuthorizationService;
  const config = {
    get: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('permits a non-loopback bootstrap request only with the configured bootstrap token', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (config.get as jest.Mock).mockReturnValue('bootstrap-secret');
    const guard = new OwnerAuthorizationGuard(reflector, authorization, config);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-admin-bootstrap-token': 'bootstrap-secret' },
          socket: { remoteAddress: '172.20.0.1' },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authorization.assertAuthorized).not.toHaveBeenCalled();
  });
});
