import { GoalCommands, ProfileCommands, ProjectCommands, ServiceTokens, TimelineCommands } from '@optimistic-tanuki/constants';
import { CreateProfileDto, ProfileDto, UpdateProfileDto, CreateTimelineDto, UpdateTimelineDto, TimelineEventType } from '@optimistic-tanuki/models';
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

describe('ProfileController', () => {
  let controller: ProfileController;
  let clientProxy: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        Logger,
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },{
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },{
          provide: ServiceTokens.ASSETS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },
        {
          provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },
        {
          provide: RoleInitService,
          useValue: {
            initializeRoles: jest.fn().mockResolvedValue(undefined),
            enqueue: jest.fn().mockResolvedValue(undefined),
          }
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
      ]
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => of(true) })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => of(true) }) // Mock PermissionsGuard
    .compile();

    controller = module.get<ProfileController>(ProfileController);
    clientProxy = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
      skills: 'Coding'
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await controller.createProfile(createProfileDto, 'test');
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Create }, createProfileDto);
    expect(createResponse).toEqual({});
  });

  it('should get a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await controller.getProfile(id, 'test');
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Get }, { id });
    expect(getResponse).toEqual({});
  });

  it('should get all profiles', async () => {
    const query = { userId: 'testUserId' } as Partial<ProfileDto>;
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of([]));

    const getAllResponse = await firstValueFrom(controller.getAllProfiles({ userId: 'user1234' } as UserDetails, query));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.GetAll }, { userId: 'user1234', query });
    expect(getAllResponse).toEqual([]);
  });

  it('should update a profile', async () => {
    const id = '1';
    const updateProfileDto: UpdateProfileDto = { id, 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding'
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(controller.updateProfile(id, updateProfileDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Update }, { id, ...updateProfileDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteProfile(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Delete }, id);
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

    const createResponse = await firstValueFrom(controller.createTimeline(createTimelineDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Create }, createTimelineDto);
    expect(createResponse).toEqual({});
  });

  it('should get a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Get }, id);
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

    const updateResponse = await firstValueFrom(controller.updateTimeline(id, updateTimelineDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Update }, { id, ...updateTimelineDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Delete }, id);
    expect(deleteResponse).toEqual({});
  });
});
