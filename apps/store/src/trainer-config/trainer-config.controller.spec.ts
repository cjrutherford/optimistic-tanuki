import { TrainerConfigController } from './trainer-config.controller';
import { TrainerConfigService } from './trainer-config.service';

describe('TrainerConfigController', () => {
  it('returns lead context and extended site sections in config payloads', async () => {
    const service = {
      getConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        brand: { businessName: 'North Star Advisory' },
        contact: { consultationLabel: 'Book strategy session' },
        features: { booking: { enabled: true } },
        services: [{ id: 'service-1', name: 'Strategy Intensive' }],
        landingPage: { layout: 'single-column', sections: [] },
        clientPortal: { headline: 'Portal' },
        testimonials: [],
        theme: { mode: 'light' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }),
    } as unknown as TrainerConfigService;

    const controller = new TrainerConfigController(service);

    await expect(
      controller.getConfig({ configKey: 'default' })
    ).resolves.toEqual({
      configId: 'cfg-1',
      config: {
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
        brand: { businessName: 'North Star Advisory' },
        contact: { consultationLabel: 'Book strategy session' },
        features: { booking: { enabled: true } },
        services: [{ id: 'service-1', name: 'Strategy Intensive' }],
        landingPage: { layout: 'single-column', sections: [] },
        clientPortal: { headline: 'Portal' },
        testimonials: [],
        theme: { mode: 'light' },
      },
    });
  });
});
