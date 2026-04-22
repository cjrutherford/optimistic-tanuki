import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  it('generates cross-app URLs through the registry service', () => {
    const service = new NavigationService({
      getAppUrl: jest
        .fn()
        .mockReturnValue('https://haicomputer.com/build/new?source=hai'),
    } as any);

    expect(
      service.generateUrl('system-configurator', '/build/new', {
        source: 'hai',
      })
    ).toBe('https://haicomputer.com/build/new?source=hai');
  });
});
