import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

describe('OAuthController', () => {
  let oauthService: jest.Mocked<
    Pick<OAuthService, 'getProviders' | 'getApps' | 'validate' | 'testProvider'>
  >;
  let controller: OAuthController;

  beforeEach(() => {
    oauthService = {
      getProviders: jest.fn(),
      getApps: jest.fn(),
      validate: jest.fn(),
      testProvider: jest.fn(),
    } as any;
    controller = new OAuthController(oauthService as any);
  });

  it('getProviders delegates to the service', async () => {
    oauthService.getProviders.mockResolvedValue({
      enabled: true,
      bridgeAppId: 'client-interface',
      bridgeAppDomain: 'app.example.com',
      providers: [],
    });
    await expect(controller.getProviders()).resolves.toMatchObject({
      enabled: true,
    });
  });

  it('getApps delegates to the service', async () => {
    oauthService.getApps.mockResolvedValue({ apps: [] });
    await expect(controller.getApps()).resolves.toEqual({ apps: [] });
  });

  it('validate delegates to the service', async () => {
    oauthService.validate.mockResolvedValue({ valid: true, issues: [] });
    await expect(controller.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  it('testProvider passes the provider name through', async () => {
    oauthService.testProvider.mockResolvedValue({
      provider: 'google',
      reachable: true,
      credentialValid: true,
      authorizationEndpointOk: true,
      tokenEndpointOk: true,
      userInfoEndpointOk: true,
      responseTimeMs: 5,
      testedAt: 'now',
      errors: [],
    });
    await controller.testProvider('google');
    expect(oauthService.testProvider).toHaveBeenCalledWith('google');
  });
});
