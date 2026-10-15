import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, of, throwError } from 'rxjs';
import { GuardianAssetAuthorizationService } from './guardian-asset-authorization.service';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';

describe('GuardianAssetAuthorizationService', () => {
  const profileClient = { send: jest.fn() } as unknown as ClientProxy;
  const authClient = { send: jest.fn() } as unknown as ClientProxy;
  let service: GuardianAssetAuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GuardianAssetAuthorizationService(profileClient, authClient);
    (profileClient.send as jest.Mock).mockReturnValue(of({
      id: 'dependent-profile', userId: 'dependent-user', appScope: 'client-interface',
    }));
    (authClient.send as jest.Mock).mockReturnValue(of({ success: true }));
  });

  it('resolves exact target profile and reauthorizes current guardian access', async () => {
    await service.assertAccess({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.manage',
    });

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get }, { id: 'dependent-profile' }
    );
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.AuthorizeGuardianContentOperation },
      {
        actorUserId: 'guardian-user', dependentUserId: 'dependent-user',
        appId: 'client-interface', operation: 'content.manage',
      }
    );
  });

  it('denies a profile whose stored app scope differs from the signed app', async () => {
    (profileClient.send as jest.Mock).mockReturnValue(of({
      id: 'dependent-profile', userId: 'dependent-user', appScope: 'local-hub',
    }));
    await expect(service.assertAccess({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.view',
    })).rejects.toBeInstanceOf(RpcException);
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('fails closed when Authentication reports a revoked guardian link', async () => {
    (authClient.send as jest.Mock).mockReturnValue(throwError(() =>
      new RpcException({ statusCode: 403, code: 'GUARDIAN_CONTENT_ACCESS_DENIED' })
    ));
    await expect(service.assertAccess({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.view',
    })).rejects.toBeInstanceOf(RpcException);
  });
});
