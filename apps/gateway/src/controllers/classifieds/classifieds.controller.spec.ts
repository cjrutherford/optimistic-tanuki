import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  ClassifiedCommands,
  CommunityCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { ClassifiedsController } from './classifieds.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { ProfileTelosRefreshService } from '../../app/profile-telos-refresh.service';

describe('ClassifiedsController', () => {
  let controller: ClassifiedsController;
  let classifiedsClient: jest.Mocked<ClientProxy>;
  let socialClient: jest.Mocked<ClientProxy>;
  let telosRefresh: { queueSourceRefresh: jest.Mock };

  beforeEach(async () => {
    classifiedsClient = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    socialClient = {
      send: jest.fn().mockReturnValue(of(null)),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    telosRefresh = {
      queueSourceRefresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassifiedsController],
      providers: [
        {
          provide: ServiceTokens.CLASSIFIEDS_SERVICE,
          useValue: classifiedsClient,
        },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: socialClient,
        },
        {
          provide: ProfileTelosRefreshService,
          useValue: telosRefresh,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ClassifiedsController>(ClassifiedsController);
  });

  it('queues a TELOS refresh after creating a classified ad', async () => {
    classifiedsClient.send.mockReturnValueOnce(
      of({
        id: 'ad-1',
        profileId: 'profile-1',
      })
    );

    await controller.create(
      { profileId: 'profile-1', userId: 'user-1' } as any,
      {
        title: 'Vintage Synth Keyboard',
        description: 'Restored keyboard',
        price: 450,
      },
      'local-hub'
    );

    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        namespaceKey: 'classifieds',
      })
    );
  });

  it('resolves a community slug for create payloads before persisting', async () => {
    socialClient.send.mockReturnValueOnce(of({ id: 'community-1' }));
    classifiedsClient.send.mockReturnValueOnce(of({ id: 'ad-1' }));

    await controller.create(
      { profileId: 'profile-1', userId: 'user-1' } as any,
      {
        communitySlug: 'builders-guild',
        title: 'Desk',
        description: 'Adjustable desk',
        price: 300,
      },
      'local-hub'
    );

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.FIND_BY_SLUG },
      { slug: 'builders-guild' }
    );
    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.CREATE },
      expect.objectContaining({
        dto: expect.objectContaining({
          communityId: 'community-1',
        }),
      })
    );
  });

  it('queues a TELOS refresh for the listing owner when featuring another profile’s ad', async () => {
    classifiedsClient.send.mockReturnValueOnce(
      of({
        id: 'ad-2',
        profileId: 'seller-profile',
      })
    );

    await controller.feature(
      { profileId: 'moderator-profile', userId: 'mod-1' } as any,
      'ad-2',
      { durationDays: 7 },
      'local-hub'
    );

    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'seller-profile',
        namespaceKey: 'classifieds',
      })
    );
  });
});
