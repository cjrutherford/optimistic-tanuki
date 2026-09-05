import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';

describe('DeploymentController', () => {
  let deploymentService: jest.Mocked<
    Pick<DeploymentService, 'getHealth' | 'getImages' | 'getRolloutHistory'>
  >;
  let controller: DeploymentController;

  beforeEach(() => {
    deploymentService = {
      getHealth: jest.fn(),
      getImages: jest.fn(),
      getRolloutHistory: jest.fn(),
    } as any;
    controller = new DeploymentController(deploymentService as any);
  });

  it('getPublicStatus derives service count from images', () => {
    deploymentService.getHealth.mockReturnValue({} as any);
    deploymentService.getImages.mockReturnValue([
      { serviceId: 'gateway' } as any,
      { serviceId: 'auth' } as any,
    ]);
    const result = controller.getPublicStatus();
    expect(result).toMatchObject({
      deploymentName: 'production',
      serviceCount: 2,
      oauthEnabled: true,
      oauthProviders: 0,
    });
  });

  it('getRolloutPreview batches services and defaults the tag', () => {
    deploymentService.getImages.mockReturnValue([
      { serviceId: 's1' } as any,
      { serviceId: 's2' } as any,
      { serviceId: 's3' } as any,
      { serviceId: 's4' } as any,
      { serviceId: 's5' } as any,
    ]);
    const result = controller.getRolloutPreview();
    expect(result.targetTag).toBe('latest');
    expect(result.waves).toEqual([['s1', 's2', 's3', 's4'], ['s5']]);
  });

  it('getRolloutPreview uses the provided tag', () => {
    deploymentService.getImages.mockReturnValue([]);
    const result = controller.getRolloutPreview('v2');
    expect(result.targetTag).toBe('v2');
    expect(result.waves).toEqual([]);
  });

  it('getLatestRollout returns pending when there is no history', () => {
    deploymentService.getRolloutHistory.mockReturnValue([]);
    expect(controller.getLatestRollout()).toEqual({ status: 'pending' });
  });

  it('getLatestRollout returns the most recent rollout state', () => {
    const state = { status: 'succeeded' } as any;
    deploymentService.getRolloutHistory.mockReturnValue([state]);
    expect(controller.getLatestRollout()).toBe(state);
    expect(deploymentService.getRolloutHistory).toHaveBeenCalledWith(1);
  });

  it('startRollout defaults tag to latest and lists service ids', () => {
    deploymentService.getImages.mockReturnValue([
      { serviceId: 'gateway' } as any,
    ]);
    expect(controller.startRollout()).toEqual({
      status: 'running',
      targetTag: 'latest',
      services: ['gateway'],
    });
    expect(controller.startRollout('v3')).toMatchObject({ targetTag: 'v3' });
  });

  it('getOAuthInspect returns a static inspection payload', () => {
    expect(controller.getOAuthInspect()).toEqual({
      enabled: true,
      bridgeApp: 'client-interface',
      providers: [],
    });
  });

  it('getHealth and getImages delegate to the service', () => {
    deploymentService.getHealth.mockReturnValue({
      configStatus: 'current',
    } as any);
    expect(controller.getHealth()).toEqual({ configStatus: 'current' });

    deploymentService.getImages.mockReturnValue([{ serviceId: 'x' } as any]);
    expect(controller.getImages()).toEqual([{ serviceId: 'x' }]);
  });

  it('getRolloutHistory parses the limit query param, defaulting to 20', () => {
    deploymentService.getRolloutHistory.mockReturnValue([]);
    controller.getRolloutHistory();
    expect(deploymentService.getRolloutHistory).toHaveBeenCalledWith(20);

    controller.getRolloutHistory('5');
    expect(deploymentService.getRolloutHistory).toHaveBeenCalledWith(5);
  });
});
