import { Test, TestingModule } from '@nestjs/testing';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';

/**
 * Named interface rather than an index-signature map: specs compile with
 * `noPropertyAccessFromIndexSignature`.
 */
interface MockClassifiedsService {
  create: jest.Mock;
  findById: jest.Mock;
  findIdsByUser: jest.Mock;
  findByCommunity: jest.Mock;
  findByProfile: jest.Mock;
  search: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  markSold: jest.Mock;
  feature: jest.Mock;
  unfeature: jest.Mock;
}

describe('ClassifiedsController message handlers', () => {
  let controller: ClassifiedsController;
  let service: MockClassifiedsService;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'ad-1' }),
      findById: jest.fn().mockResolvedValue({ id: 'ad-1' }),
      findIdsByUser: jest.fn().mockResolvedValue(['ad-1']),
      findByCommunity: jest.fn().mockResolvedValue([{ id: 'ad-1' }]),
      findByProfile: jest.fn().mockResolvedValue([{ id: 'ad-1' }]),
      search: jest.fn().mockResolvedValue([{ id: 'ad-1' }]),
      update: jest.fn().mockResolvedValue({ id: 'ad-1', title: 'Updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
      markSold: jest.fn().mockResolvedValue({ id: 'ad-1', status: 'sold' }),
      feature: jest.fn().mockResolvedValue({ id: 'ad-1', isFeatured: true }),
      unfeature: jest.fn().mockResolvedValue({ id: 'ad-1', isFeatured: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassifiedsController],
      providers: [{ provide: ClassifiedsService, useValue: service }],
    }).compile();

    controller = module.get(ClassifiedsController);
  });

  it('forwards the create payload as positional service arguments', async () => {
    const dto = { title: 'Bicycle', description: 'Red', price: 120 };

    await expect(
      controller.create({
        dto,
        profileId: 'profile-1',
        userId: 'user-1',
        appScope: 'regional-hub',
      })
    ).resolves.toEqual({ id: 'ad-1' });
    expect(service.create).toHaveBeenCalledWith(
      dto,
      'profile-1',
      'user-1',
      'regional-hub'
    );
  });

  it('passes an absent appScope through as undefined so the service default applies', async () => {
    await controller.create({
      dto: { title: 'Guitar', description: 'Acoustic', price: 300 },
      profileId: 'profile-2',
      userId: 'user-2',
    });

    expect(service.create).toHaveBeenCalledWith(
      expect.anything(),
      'profile-2',
      'user-2',
      undefined
    );
  });

  it('resolves a single ad by id', async () => {
    await expect(controller.findById({ id: 'ad-1' })).resolves.toEqual({
      id: 'ad-1',
    });
    expect(service.findById).toHaveBeenCalledWith('ad-1');
  });

  it('resolves community ads with the requested scope', async () => {
    await expect(
      controller.findByCommunity({
        communityId: 'community-1',
        appScope: 'local-hub',
      })
    ).resolves.toEqual([{ id: 'ad-1' }]);
    expect(service.findByCommunity).toHaveBeenCalledWith(
      'community-1',
      'local-hub'
    );
  });

  it('resolves ads for a profile', async () => {
    await expect(
      controller.findByProfile({ profileId: 'profile-1' })
    ).resolves.toEqual([{ id: 'ad-1' }]);
    expect(service.findByProfile).toHaveBeenCalledWith('profile-1');
  });

  it('passes the search payload straight through as the search dto', async () => {
    const dto = { query: 'bike', minPrice: 10, page: 2 };

    await expect(controller.search(dto)).resolves.toEqual([{ id: 'ad-1' }]);
    expect(service.search).toHaveBeenCalledWith(dto);
  });

  it('forwards the update payload with the caller profile for the ownership check', async () => {
    const dto = { title: 'Updated' };

    await expect(
      controller.update({ id: 'ad-1', dto, profileId: 'profile-1' })
    ).resolves.toEqual({ id: 'ad-1', title: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('ad-1', dto, 'profile-1');
  });

  it('forwards removal with the caller profile', async () => {
    await expect(
      controller.remove({ id: 'ad-1', profileId: 'profile-1' })
    ).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith('ad-1', 'profile-1');
  });

  it('forwards the mark-sold command', async () => {
    await expect(
      controller.markSold({ id: 'ad-1', profileId: 'profile-1' })
    ).resolves.toEqual({ id: 'ad-1', status: 'sold' });
    expect(service.markSold).toHaveBeenCalledWith('ad-1', 'profile-1');
  });

  it('forwards the feature command including the duration', async () => {
    await expect(
      controller.feature({
        id: 'ad-1',
        profileId: 'profile-1',
        durationDays: 7,
      })
    ).resolves.toEqual({ id: 'ad-1', isFeatured: true });
    expect(service.feature).toHaveBeenCalledWith('ad-1', 'profile-1', 7);
  });

  it('forwards the unfeature command', async () => {
    await expect(
      controller.unfeature({ id: 'ad-1', profileId: 'profile-1' })
    ).resolves.toEqual({
      id: 'ad-1',
      isFeatured: false,
    });
    // The owning profile travels with the command so the service can refuse a
    // caller who does not own the ad.
    expect(service.unfeature).toHaveBeenCalledWith('ad-1', 'profile-1');
  });

  it('surfaces service failures to the message broker', async () => {
    service.findById.mockRejectedValue(
      new Error('Classified ad ad-9 not found')
    );

    await expect(controller.findById({ id: 'ad-9' })).rejects.toThrow(
      'Classified ad ad-9 not found'
    );
  });
});
