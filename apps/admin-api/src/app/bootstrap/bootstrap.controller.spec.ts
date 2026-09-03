import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

describe('BootstrapController', () => {
  let bootstrapService: jest.Mocked<
    Pick<
      BootstrapService,
      | 'getStatus'
      | 'scaffoldConfig'
      | 'loadConfig'
      | 'saveConfig'
      | 'loadSecrets'
      | 'saveSecrets'
      | 'validate'
      | 'buildImages'
      | 'provisionInfraCompose'
      | 'provisionInfraK8s'
      | 'initDatabases'
      | 'deployServices'
      | 'createOwner'
      | 'completeSetup'
      | 'configureOAuthProvider'
    >
  >;
  let controller: BootstrapController;

  beforeEach(() => {
    bootstrapService = {
      getStatus: jest.fn(),
      scaffoldConfig: jest.fn(),
      loadConfig: jest.fn(),
      saveConfig: jest.fn(),
      loadSecrets: jest.fn(),
      saveSecrets: jest.fn(),
      validate: jest.fn(),
      buildImages: jest.fn(),
      provisionInfraCompose: jest.fn(),
      provisionInfraK8s: jest.fn(),
      initDatabases: jest.fn(),
      deployServices: jest.fn(),
      createOwner: jest.fn(),
      completeSetup: jest.fn(),
      configureOAuthProvider: jest.fn(),
    } as any;
    controller = new BootstrapController(bootstrapService as any);
  });

  it('getStatus delegates to the service', async () => {
    bootstrapService.getStatus.mockResolvedValue({
      configured: true,
      phase: 'ready',
      checks: [],
    });
    await expect(controller.getStatus()).resolves.toEqual({
      configured: true,
      phase: 'ready',
      checks: [],
    });
  });

  it('scaffoldConfig wraps the service result', async () => {
    bootstrapService.scaffoldConfig.mockResolvedValue({
      config: { foo: 'bar' } as any,
      secrets: {},
    });
    const result = await controller.scaffoldConfig({
      name: 'prod',
      target: 'compose',
      operatorName: 'Op',
      operatorEmail: 'op@example.com',
      services: ['gateway'],
    });
    expect(bootstrapService.scaffoldConfig).toHaveBeenCalledWith({
      name: 'prod',
      target: 'compose',
      operatorName: 'Op',
      operatorEmail: 'op@example.com',
      services: ['gateway'],
    });
    expect(result).toEqual({
      success: true,
      data: { config: { foo: 'bar' }, secrets: {} },
    });
  });

  it('getState wraps loadConfig result', async () => {
    bootstrapService.loadConfig.mockResolvedValue({ x: 1 } as any);
    await expect(controller.getState()).resolves.toEqual({
      success: true,
      data: { x: 1 },
    });
  });

  it('putState delegates to saveConfig', async () => {
    await expect(controller.putState({ a: 1 })).resolves.toEqual({
      success: true,
    });
    expect(bootstrapService.saveConfig).toHaveBeenCalledWith({ a: 1 });
  });

  it('getSecrets masks secret values', async () => {
    bootstrapService.loadSecrets.mockResolvedValue({
      SHORT: 'ab',
      LONG: 'abcdefgh',
      EMPTY: '',
    });
    const result = await controller.getSecrets();
    expect(result).toEqual({
      success: true,
      data: { SHORT: '****', LONG: '****efgh', EMPTY: '****' },
    });
  });

  it('putSecrets delegates to saveSecrets', async () => {
    await expect(controller.putSecrets({ FOO: 'bar' })).resolves.toEqual({
      success: true,
    });
    expect(bootstrapService.saveSecrets).toHaveBeenCalledWith({ FOO: 'bar' });
  });

  it('validate delegates to the service', async () => {
    bootstrapService.validate.mockResolvedValue({ valid: true, issues: [] });
    await expect(controller.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  it('buildImages, infraCompose, infraK8s, initDatabases, and deploy all delegate', async () => {
    bootstrapService.buildImages.mockResolvedValue({
      success: true,
      message: 'built',
    });
    bootstrapService.provisionInfraCompose.mockResolvedValue({
      success: true,
      message: 'compose',
    });
    bootstrapService.provisionInfraK8s.mockResolvedValue({
      success: true,
      message: 'k8s',
    });
    bootstrapService.initDatabases.mockResolvedValue({
      success: true,
      message: 'db',
    });
    bootstrapService.deployServices.mockResolvedValue({
      success: true,
      message: 'deployed',
    });

    await expect(controller.buildImages()).resolves.toEqual({
      success: true,
      message: 'built',
    });
    await expect(controller.infraCompose()).resolves.toEqual({
      success: true,
      message: 'compose',
    });
    await expect(controller.infraK8s('kc')).resolves.toEqual({
      success: true,
      message: 'k8s',
    });
    expect(bootstrapService.provisionInfraK8s).toHaveBeenCalledWith('kc');
    await expect(controller.initDatabases()).resolves.toEqual({
      success: true,
      message: 'db',
    });
    await expect(controller.deploy()).resolves.toEqual({
      success: true,
      message: 'deployed',
    });
  });

  describe('deployAll', () => {
    it('stops at build-images when it fails', async () => {
      bootstrapService.buildImages.mockResolvedValue({
        success: false,
        message: 'build failed',
      });
      const result = await controller.deployAll();
      expect(result).toEqual({
        phase: 'build-images',
        success: false,
        message: 'build failed',
      });
      expect(bootstrapService.provisionInfraCompose).not.toHaveBeenCalled();
    });

    it('stops at infra-compose when it fails', async () => {
      bootstrapService.buildImages.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.provisionInfraCompose.mockResolvedValue({
        success: false,
        message: 'infra failed',
      });
      const result = await controller.deployAll();
      expect(result).toEqual({
        phase: 'infra-compose',
        success: false,
        message: 'infra failed',
      });
      expect(bootstrapService.initDatabases).not.toHaveBeenCalled();
    });

    it('stops at init-databases when it fails', async () => {
      bootstrapService.buildImages.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.provisionInfraCompose.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.initDatabases.mockResolvedValue({
        success: false,
        message: 'db failed',
      });
      const result = await controller.deployAll();
      expect(result).toEqual({
        phase: 'init-databases',
        success: false,
        message: 'db failed',
      });
      expect(bootstrapService.deployServices).not.toHaveBeenCalled();
    });

    it('runs the full pipeline and returns the deploy result on success', async () => {
      bootstrapService.buildImages.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.provisionInfraCompose.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.initDatabases.mockResolvedValue({
        success: true,
        message: 'ok',
      });
      bootstrapService.deployServices.mockResolvedValue({
        success: true,
        message: 'deployed',
      });
      const result = await controller.deployAll();
      expect(result).toEqual({ success: true, message: 'deployed' });
    });
  });

  it('createOwner delegates to the service and returns its result', async () => {
    bootstrapService.createOwner.mockResolvedValue({
      created: true,
      userId: 'u1',
      profileId: 'p1',
      email: 'a@b.com',
      name: 'A',
    });
    const result = await controller.createOwner({
      name: 'A',
      email: 'a@b.com',
      password: 'pw',
    });
    expect(bootstrapService.createOwner).toHaveBeenCalledWith(
      'A',
      'a@b.com',
      'pw'
    );
    expect(result.created).toBe(true);
  });

  it('activateOwner completes setup and returns activation payload', async () => {
    const result = await controller.activateOwner();
    expect(bootstrapService.completeSetup).toHaveBeenCalled();
    expect(result).toEqual({ activated: true, profile: {} });
  });

  it('configureOAuth delegates provider config to the service', async () => {
    const result = await controller.configureOAuth({
      provider: 'google',
      enabled: true,
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://example.com/cb',
    });
    expect(bootstrapService.configureOAuthProvider).toHaveBeenCalledWith(
      'google',
      {
        enabled: true,
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/cb',
      }
    );
    expect(result).toEqual({ success: true });
  });
});
