import {
  GoalCommands,
  ProfileTelosCommands,
  ProfileCommands,
  ProjectCommands,
  ServiceTokens,
  SocialTelosCommands,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateProfileDto,
  ProfileTelosDto,
  ProfileDto,
  UpdateProfileDto,
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineEventType,
} from '@optimistic-tanuki/models';
// Removed duplicate/out-of-scope tests at the top of the file
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';

import { ClientProxy } from '@nestjs/microservices';
import { ProfileController } from './profile.controller';
import { UserDetails } from '../../decorators/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { Logger } from '@nestjs/common';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ProfileTelosRefreshService } from '../../app/profile-telos-refresh.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let clientProxy: ClientProxy;
  let socialClient: ClientProxy;
  let telosClient: ClientProxy;
  let roleInitService: { processNow: jest.Mock };
  let telosRefresh: {
    queueDirectUpsert: jest.Mock;
    queueSourceRefresh: jest.Mock;
  };

  beforeEach(async () => {
    roleInitService = {
      processNow: jest.fn().mockResolvedValue(undefined),
    };
    telosRefresh = {
      queueDirectUpsert: jest.fn(),
      queueSourceRefresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        Logger,
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.ASSETS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: RoleInitService,
          useValue: roleInitService,
        },
        {
          provide: ProfileTelosRefreshService,
          useValue: telosRefresh,
        },
        Reflector,
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidateProfile: jest.fn().mockResolvedValue(undefined),
            invalidateAppScope: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({}),
            cleanupExpired: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => of(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => of(true) }) // Mock PermissionsGuard
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    clientProxy = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
    socialClient = module.get<ClientProxy>(ServiceTokens.SOCIAL_SERVICE);
    telosClient = module.get<ClientProxy>(ServiceTokens.TELOS_DOCS_SERVICE);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses the role init service processNow API during profile creation', async () => {
    const createProfileDto: CreateProfileDto = {
      name: 'Test',
      description: 'thomas morrow',
      userId: 'user-1',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding',
    };

    jest
      .spyOn(clientProxy, 'send')
      .mockReturnValueOnce(of({ id: 'profile-1', userId: 'user-1' } as any));

    await controller.createProfile(createProfileDto, 'test');

    expect(roleInitService.processNow).toHaveBeenCalled();
  });

  it('should create a profile', async () => {
    const createProfileDto: CreateProfileDto = {
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding',
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await controller.createProfile(
      createProfileDto,
      'test'
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      createProfileDto
    );
    expect(createResponse).toEqual({});
  });

  it('should get a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await controller.getProfileById(id, 'test');
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { id }
    );
    expect(getResponse).toEqual({});
  });

  it('should get all profiles', async () => {
    const query = { userId: 'testUserId' } as Partial<ProfileDto>;
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of([]));

    const getAllResponse = await firstValueFrom(
      controller.getAllProfiles(
        { userId: 'user1234' } as UserDetails,
        query,
        'test'
      )
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      { where: { userId: 'user1234', ...query } }
    );
    expect(getAllResponse).toEqual([]);
  });

  it('should update a profile', async () => {
    const id = '1';
    const updateProfileDto: UpdateProfileDto = {
      id,
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding',
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await controller.updateProfile(id, updateProfileDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Update },
      { id, ...updateProfileDto }
    );
    expect(updateResponse).toEqual({});
  });

  it('should get a profile telos document by profile id', async () => {
    jest.spyOn(clientProxy, 'send').mockImplementation(() =>
      of({
        id: '1',
        profileName: 'Test Profile',
        appScope: 'forgeofwill',
      } as any)
    );
    jest
      .spyOn(socialClient, 'send')
      .mockImplementation(() =>
        of([
          { sourceType: 'social:summary', sourceId: '1', content: 'summary' },
        ])
      );
    const telos = {
      id: 'telos-1',
      profileId: '1',
      name: 'Test Profile',
      description: 'desc',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: 'goal',
      overallProfileSummary: 'summary',
      generationStatus: 'ready',
      sourceCount: 1,
      characterSheet: {
        classKey: 'scholar',
        classLabel: 'Scholar',
        archetypeSummary: 'Learns quickly',
        level: 3,
        stats: {
          strength: 8,
          dexterity: 10,
          constitution: 10,
          intelligence: 15,
          wisdom: 13,
          charisma: 12,
        },
        traits: ['curious'],
      },
    } as any as ProfileTelosDto;
    jest.spyOn(telosClient, 'send').mockImplementation(() => of(telos));

    const response = await controller.getProfileTelosByProfileId('1');

    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: '1',
        namespaceKey: 'social',
      })
    );
    expect(telosClient.send).toHaveBeenCalledWith(
      { cmd: ProfileTelosCommands.FIND_BY_PROFILE_ID },
      { profileId: '1' }
    );
    expect(response).toEqual(telos);
  });

  it('should request profile telos regeneration', async () => {
    jest.spyOn(telosClient, 'send').mockImplementation(() => of({ ok: true }));

    const response = await controller.regenerateProfileTelos('1');

    expect(telosClient.send).toHaveBeenCalledWith(
      { cmd: ProfileTelosCommands.REGENERATE },
      { profileId: '1' }
    );
    expect(response).toEqual({ ok: true });
  });

  it('should request bulk profile telos regeneration', async () => {
    jest.spyOn(telosClient, 'send').mockImplementation(() => of({ ok: true }));

    const response = await controller.regenerateProfileTelosBulk({
      profileIds: ['1', '2'],
    });

    expect(telosClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: ProfileTelosCommands.REGENERATE },
      { profileId: '1' }
    );
    expect(telosClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileTelosCommands.REGENERATE },
      { profileId: '2' }
    );
    expect(response).toEqual([{ ok: true }, { ok: true }]);
  });

  it('should reset derived profile telos fields', async () => {
    jest.spyOn(telosClient, 'send').mockImplementation(() => of({ ok: true }));

    const response = await controller.resetProfileTelos('1');

    expect(telosClient.send).toHaveBeenCalledWith(
      { cmd: ProfileTelosCommands.RESET_DERIVED },
      { profileId: '1' }
    );
    expect(response).toEqual({ ok: true });
  });

  it('should delete a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteProfile(id));
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Delete },
      id
    );
    expect(deleteResponse).toEqual({});
  });

  it('should create a timeline', async () => {
    const createTimelineDto: CreateTimelineDto = {
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn',
      projectId: 'a;klsdjnfgn;lkajnerg;ljn',
      goalId: 'a;klsdjnfgn;lkajnerg;ljn',
      startDate: '2021-01-01',
      endDate: '2021-01-01',
      isCompleted: true,
      isPublished: true,
      isDeleted: false,
      type: TimelineEventType.Posted,
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await firstValueFrom(
      controller.createTimeline(createTimelineDto)
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: TimelineCommands.Create },
      createTimelineDto
    );
    expect(createResponse).toEqual({});
  });

  it('should get a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: TimelineCommands.Get },
      id
    );
    expect(getResponse).toEqual({});
  });

  it('should update a timeline', async () => {
    const id = '1';
    const updateTimelineDto: UpdateTimelineDto = {
      id,
      name: 'Test',
      description: 'thomas morrow',
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(
      controller.updateTimeline(id, updateTimelineDto)
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: TimelineCommands.Update },
      { id, ...updateTimelineDto }
    );
    expect(updateResponse).toEqual({});
  });

  it('should delete a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: TimelineCommands.Delete },
      id
    );
    expect(deleteResponse).toEqual({});
  });

  it('should reject reading blocked users for another profile', async () => {
    await expect(
      controller.getBlockedUsers('profile-2', { profileId: 'profile-1' } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(socialClient.send).not.toHaveBeenCalled();
  });

  it('should reject blocking a user for another profile', async () => {
    await expect(
      controller.blockUser('profile-2', { blockedProfileId: 'blocked-1' }, {
        profileId: 'profile-1',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(socialClient.send).not.toHaveBeenCalled();
  });

  it('should reject unblocking a user for another profile', async () => {
    await expect(
      controller.unblockUser('profile-2', 'blocked-1', {
        profileId: 'profile-1',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(socialClient.send).not.toHaveBeenCalled();
  });
});
