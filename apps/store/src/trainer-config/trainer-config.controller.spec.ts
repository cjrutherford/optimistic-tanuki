import { TrainerConfigController } from './trainer-config.controller';
import { TrainerConfigService } from './trainer-config.service';

describe('TrainerConfigController', () => {
  it('returns lead context and extended site sections in config payloads', async () => {
    const service = {
      getConfigBySiteSlug: jest.fn(),
      getConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        businessType: 'consulting',
        site: { slug: 'north-star-advisory', status: 'published' },
        brand: { businessName: 'North Star Advisory' },
        contact: { consultationLabel: 'Book strategy session' },
        features: { booking: { enabled: true } },
        serviceCatalog: { source: 'manual' },
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
        businessType: 'consulting',
        site: { slug: 'north-star-advisory', status: 'published' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
        brand: { businessName: 'North Star Advisory' },
        contact: { consultationLabel: 'Book strategy session' },
        features: { booking: { enabled: true } },
        serviceCatalog: { source: 'manual' },
        services: [{ id: 'service-1', name: 'Strategy Intensive' }],
        landingPage: { layout: 'single-column', sections: [] },
        clientPortal: { headline: 'Portal' },
        testimonials: [],
        theme: { mode: 'light' },
      },
    });
  });

  it('looks up site config by slug for hosted business routes', async () => {
    const service = {
      getConfigBySiteSlug: jest.fn().mockResolvedValue({
        id: 'cfg-2',
        businessType: 'consulting',
        site: { slug: 'north-star-advisory' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
        brand: { businessName: 'North Star Advisory' },
        contact: {},
        features: {},
        serviceCatalog: {},
        services: [],
        landingPage: {},
        clientPortal: {},
        testimonials: [],
        theme: {},
      }),
      getConfig: jest.fn(),
    } as unknown as TrainerConfigService;

    const controller = new TrainerConfigController(service);

    await controller.getConfig({ slug: 'north-star-advisory' });

    expect((service as any).getConfigBySiteSlug).toHaveBeenCalledWith(
      'north-star-advisory'
    );
    expect((service as any).getConfig).not.toHaveBeenCalled();
  });

  it('looks up site config by owner profile for owner workspace routes', async () => {
    const service = {
      getConfigBySiteSlug: jest.fn(),
      getConfigByOwnerProfileId: jest.fn().mockResolvedValue({
        id: 'cfg-3',
        businessType: 'general',
        site: { slug: 'steady-hand-contracting' },
        leadContext: {
          profileId: 'owner-profile-handyman',
          appScope: 'business-site',
        },
        brand: { businessName: 'Steady Hand Contracting' },
        contact: {},
        features: {},
        serviceCatalog: {},
        services: [],
        landingPage: {},
        clientPortal: {},
        testimonials: [],
        theme: {},
      }),
      getConfig: jest.fn(),
    } as unknown as TrainerConfigService;

    const controller = new TrainerConfigController(service);

    await controller.getConfig({ profileId: 'owner-profile-handyman' });

    expect((service as any).getConfigByOwnerProfileId).toHaveBeenCalledWith(
      'owner-profile-handyman'
    );
    expect((service as any).getConfigBySiteSlug).not.toHaveBeenCalled();
    expect((service as any).getConfig).not.toHaveBeenCalled();
  });

  it('returns null config when the requested owner profile has no site config', async () => {
    const service = {
      getConfigBySiteSlug: jest.fn(),
      getConfigByOwnerProfileId: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn(),
    } as unknown as TrainerConfigService;

    const controller = new TrainerConfigController(service);

    await expect(
      controller.getConfig({ profileId: 'missing-owner-profile' })
    ).resolves.toEqual({
      configId: null,
      config: null,
    });
  });
});
