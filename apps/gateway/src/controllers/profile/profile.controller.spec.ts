import {
  AuthCommands,
  GoalCommands,
  ProfileCommands,
  ProjectCommands,
  ServiceTokens,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineEventType,
} from '@optimistic-tanuki/models';
// Removed duplicate/out-of-scope tests at the top of the file
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ClientProxy } from '@nestjs/microservices';
import { ProfileController } from './profile.controller';
import { UserDetails } from '../../decorators/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { Logger } from '@nestjs/common';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { Reflector } from '@nestjs/core';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
  ValidationPipe,
} from '@nestjs/common';

describe('ProfileController', () => {
  let controller: ProfileController;
  let clientProxy: ClientProxy;
  let authClient: ClientProxy;
  let socialClient: ClientProxy;
  let roleInitService: { processNow: jest.Mock };

  beforeEach(async () => {
    roleInitService = {
      processNow: jest.fn().mockResolvedValue(undefined),
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
    authClient = module.get<ClientProxy>(ServiceTokens.AUTHENTICATION_SERVICE);
    socialClient = module.get<ClientProxy>(ServiceTokens.SOCIAL_SERVICE);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns only profiles discoverable in the requested app scope', async () => {
    jest.spyOn(clientProxy, 'send').mockReturnValue(
      of([
        { id: 'own-local', userId: 'user-1', appScope: 'client-interface' },
        { id: 'own-global', userId: 'user-1', appScope: 'global' },
        { id: 'other-local', userId: 'user-2', appScope: 'client-interface' },
        { id: 'other-global', userId: 'user-3', appScope: 'global' },
        { id: 'other-app', userId: 'user-4', appScope: 'forgeofwill' },
      ])
    );

    await expect(
      firstValueFrom(
        controller.getDiscoverableProfiles(
          { userId: 'user-1', profileId: 'own-local' } as UserDetails,
          'client-interface'
        )
      )
    ).resolves.toEqual([
      { id: 'other-local', userId: 'user-2', appScope: 'client-interface' },
      { id: 'other-global', userId: 'user-3', appScope: 'global' },
    ]);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      {
        where: [
          { appScope: 'client-interface' },
          { appScope: 'global' },
          { appScope: null },
        ],
      }
    );
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

    await controller.createProfile(createProfileDto, 'test', {
      userId: 'user-1',
    } as UserDetails);

    expect(roleInitService.processNow).toHaveBeenCalled();
  });

  it('rejects creating a profile for another user before profile or token writes', async () => {
    const createProfileDto: CreateProfileDto = {
      name: 'Test',
      description: 'thomas morrow',
      userId: 'attacker-selected-user',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding',
    };
    const profileSend = jest.spyOn(clientProxy, 'send');
    const authSend = jest.spyOn(authClient, 'send');
    await expect(
      controller.createProfile(createProfileDto, 'client-interface', {
        userId: 'authenticated-user',
      } as UserDetails)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(profileSend).not.toHaveBeenCalled();
    expect(authSend).not.toHaveBeenCalled();
  });

  it('rejects an absent profile owner before profile or token writes', async () => {
    const profileSend = jest.spyOn(clientProxy, 'send');
    const authSend = jest.spyOn(authClient, 'send');
    await expect(
      controller.createProfile(
        { name: 'Test', userId: '' } as CreateProfileDto,
        'client-interface',
        { userId: 'authenticated-user' } as UserDetails
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(profileSend).not.toHaveBeenCalled();
    expect(authSend).not.toHaveBeenCalled();
  });

  it('uses the authenticated user for a legitimate profile creation', async () => {
    const createProfileDto: CreateProfileDto = {
      name: 'Test',
      description: 'bio',
      userId: 'authenticated-user',
    } as CreateProfileDto;
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValueOnce(
        of({ id: 'new-profile', userId: 'authenticated-user' } as any)
      );
    const authSend = jest
      .spyOn(authClient, 'send')
      .mockReturnValueOnce(of({ data: { newToken: 'legacy-token' } }));

    const response = await controller.createProfile(
      createProfileDto,
      'client-interface',
      { userId: 'authenticated-user' } as UserDetails
    );
    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({ userId: 'authenticated-user' })
    );
    expect(authSend).toHaveBeenCalledWith(
      { cmd: AuthCommands.Issue },
      { userId: 'authenticated-user', profileId: 'new-profile' }
    );
    expect(response).toEqual({
      profile: { id: 'new-profile', userId: 'authenticated-user' },
      newToken: 'legacy-token',
    });
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
      userId: 'profile-owner',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding',
    };
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValueOnce(
        of({ id, userId: 'profile-owner', appScope: 'client-interface' }) as any
      )
      .mockReturnValueOnce(of({}) as any);

    const updateResponse = await controller.updateProfile(
      id,
      updateProfileDto,
      {
        userId: 'profile-owner',
        appId: 'client-interface',
      } as UserDetails
    );
    expect(profileSend).toHaveBeenNthCalledWith(
      1,
      { cmd: ProfileCommands.Get },
      { id }
    );
    expect(profileSend).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileCommands.Update },
      expect.not.objectContaining({ userId: 'profile-owner' })
    );
    expect(updateResponse).toEqual({});
  });

  it('rejects a legacy profile owner change before forwarding a write', async () => {
    const profileSend = jest.spyOn(clientProxy, 'send').mockReturnValue(
      of({
        id: 'target',
        userId: 'dependent',
        appScope: 'client-interface',
      }) as any
    );
    await expect(
      controller.updateProfile(
        'target',
        { userId: 'forged-owner' } as UpdateProfileDto,
        { userId: 'guardian', appId: 'client-interface' } as UserDetails
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(profileSend).toHaveBeenCalledTimes(1);
  });

  it('accepts a validated full-profile self edit with verified immutable identity and scope', async () => {
    const ownerId = '9d8c3a2f-1a7c-4c2b-91a4-0db6a291f631';
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const body = await pipe.transform(
      {
        id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
        name: 'Updated name',
        userId: ownerId,
        appScope: 'client-interface',
      },
      { type: 'body', metatype: UpdateProfileDto }
    );
    expect(body.appScope).toBe('client-interface');

    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValueOnce(
        of({
          id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
          userId: ownerId,
          appScope: 'client-interface',
        }) as any
      )
      .mockReturnValueOnce(
        of({ id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1' }) as any
      );

    await controller.updateProfile(
      '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
      body,
      { userId: ownerId, appId: 'client-interface' } as UserDetails
    );

    expect(profileSend).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileCommands.Update },
      { id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1', name: 'Updated name' }
    );
  });

  it('rejects a validated full-profile self edit that changes its stored app scope', async () => {
    const ownerId = '9d8c3a2f-1a7c-4c2b-91a4-0db6a291f631';
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const body = await pipe.transform(
      {
        id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
        name: 'Updated name',
        userId: ownerId,
        appScope: 'local-hub',
      },
      { type: 'body', metatype: UpdateProfileDto }
    );
    const profileSend = jest.spyOn(clientProxy, 'send').mockReturnValue(
      of({
        id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
        userId: ownerId,
        appScope: 'client-interface',
      }) as any
    );

    await expect(
      controller.updateProfile('6dc2fdad-ef99-48a0-98e0-9e2f223354c1', body, {
        userId: ownerId,
        appId: 'client-interface',
      } as UserDetails)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(profileSend).toHaveBeenCalledTimes(1);
  });

  it('rejects a legacy body profile ID that differs from the route ID', async () => {
    const profileSend = jest.spyOn(clientProxy, 'send').mockReturnValue(
      of({
        id: '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
        userId: '9d8c3a2f-1a7c-4c2b-91a4-0db6a291f631',
        appScope: 'client-interface',
      }) as any
    );
    await expect(
      controller.updateProfile(
        '6dc2fdad-ef99-48a0-98e0-9e2f223354c1',
        { id: 'a9a74f45-a1f1-47dd-8ee3-6825f0d82e55' } as UpdateProfileDto,
        {
          userId: '9d8c3a2f-1a7c-4c2b-91a4-0db6a291f631',
          appId: 'client-interface',
        } as UserDetails
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profileSend).toHaveBeenCalledTimes(1);
  });

  it('sends a dependent profile view to the owning service with the verified actor and app', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(of({ id: 'dependent-profile' }) as any);
    await controller.getDependentProfile('dependent-profile', {
      userId: 'guardian',
      appId: 'client-interface',
    } as UserDetails);
    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetGuardian },
      expect.objectContaining({
        profileId: 'dependent-profile',
        actorUserId: 'guardian',
        appId: 'client-interface',
        operation: 'profile.view',
      })
    );
  });

  it('lists only server-linked profiles from the authenticated app scope and omits account identity fields', async () => {
    jest.spyOn(authClient, 'send').mockReturnValue(
      of([
        { dependentUserId: 'linked-user', status: 'approved' },
        { dependentUserId: 'foreign-user', status: 'approved' },
      ]) as any
    );
    jest.spyOn(clientProxy, 'send').mockImplementation(
      (_pattern: any, payload: any) =>
        of(
          payload.userId === 'linked-user'
            ? {
                id: 'linked-profile',
                userId: 'linked-user',
                appScope: 'local-hub',
                profileName: 'Linked teen',
                email: 'private@example.invalid',
                dateOfBirth: '2010-01-01',
              }
            : {
                id: 'foreign-profile',
                userId: 'foreign-user',
                appScope: 'client-interface',
                profileName: 'Wrong app',
              }
        ) as any
    );
    await expect(
      controller.listGuardianDependents({
        userId: 'guardian',
        appId: 'local-hub',
      } as UserDetails)
    ).resolves.toEqual([
      {
        dependentUserId: 'linked-user',
        profileId: 'linked-profile',
        profileName: 'Linked teen',
        profilePic: '',
        coverPic: '',
        status: 'approved',
      },
    ]);
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ListGuardianDependents },
      { guardianUserId: 'guardian' }
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetGuardianConsoleProfile },
      { userId: 'linked-user', appScope: 'local-hub' }
    );
  });

  it('uses the verified local-hub context for guardian access without a caller scope parameter', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(of({ id: 'dependent-profile' }) as any);
    await controller.getDependentProfile('dependent-profile', {
      userId: 'guardian',
      appId: 'local-hub',
    } as UserDetails);
    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetGuardian },
      expect.objectContaining({ appId: 'local-hub', actorUserId: 'guardian' })
    );
  });

  it('keeps a guardian request scoped to its verified client-interface context', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(of({ id: 'dependent-profile' }) as any);
    await controller.getDependentProfile('dependent-profile', {
      userId: 'guardian',
      appId: 'client-interface',
    } as UserDetails);
    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetGuardian },
      expect.objectContaining({
        appId: 'client-interface',
        actorUserId: 'guardian',
      })
    );
    expect(profileSend).not.toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetGuardian },
      expect.objectContaining({ appId: 'local-hub' })
    );
  });

  it('fails closed for guardian routes without a verified application context', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(of({ id: 'dependent-profile' }) as any);
    await expect(
      controller.getDependentProfile('dependent-profile', {
        userId: 'guardian',
      } as UserDetails)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(profileSend).not.toHaveBeenCalled();
  });

  it('allows a normal local-hub self edit from the verified context', async () => {
    const ownerId = '9d8c3a2f-1a7c-4c2b-91a4-0db6a291f631';
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValueOnce(
        of({ id: 'own-profile', userId: ownerId, appScope: 'local-hub' }) as any
      )
      .mockReturnValueOnce(of({ id: 'own-profile' }) as any);
    await controller.updateProfile(
      'own-profile',
      {
        name: 'Updated name',
        userId: ownerId,
        appScope: 'local-hub',
      } as UpdateProfileDto,
      { userId: ownerId, appId: 'local-hub' } as UserDetails
    );
    expect(profileSend).toHaveBeenCalledTimes(2);
    expect(profileSend).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileCommands.Update },
      { id: 'own-profile', name: 'Updated name' }
    );
  });

  it('fails closed for an owned app profile while lifecycle deletion is unavailable', async () => {
    const profileSend = jest.spyOn(clientProxy, 'send').mockReturnValue(
      of({
        id: 'owned-app',
        userId: 'user-1',
        appScope: 'client-interface',
      }) as any
    );

    await expect(
      controller.deleteProfile('owned-app', 'client-interface', {
        userId: 'user-1',
        profileId: 'owned-app',
      } as UserDetails)
    ).rejects.toBeInstanceOf(NotImplementedException);

    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { id: 'owned-app' }
    );
    expect(profileSend).not.toHaveBeenCalledWith(
      { cmd: ProfileCommands.Delete },
      expect.anything()
    );
  });

  it.each([
    [
      'another owner, even with an elevated role',
      { id: 'target', userId: 'user-2', appScope: 'client-interface' },
      'client-interface',
    ],
    [
      'unknown owner',
      { id: 'target', userId: null, appScope: 'client-interface' },
      'client-interface',
    ],
    [
      'another app scope',
      { id: 'target', userId: 'user-1', appScope: 'forgeofwill' },
      'client-interface',
    ],
    [
      'global scope',
      { id: 'target', userId: 'user-1', appScope: 'global' },
      'client-interface',
    ],
    [
      'legacy null scope',
      { id: 'target', userId: 'user-1', appScope: null },
      'client-interface',
    ],
  ])(
    'does not request deletion for %s targets',
    async (_reason, profile, appScope) => {
      const profileSend = jest
        .spyOn(clientProxy, 'send')
        .mockReturnValue(of(profile) as any);

      await expect(
        controller.deleteProfile('target', appScope, {
          userId: 'user-1',
          profileId: 'current-profile',
          roles: ['global_admin', 'moderator'],
        } as UserDetails & { roles: string[] })
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(profileSend).not.toHaveBeenCalledWith(
        { cmd: ProfileCommands.Delete },
        expect.anything()
      );
    }
  );

  it('returns not found without requesting deletion when the target profile is absent', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(of(null) as any);

    await expect(
      controller.deleteProfile('missing', 'client-interface', {
        userId: 'user-1',
        profileId: 'current-profile',
      } as UserDetails)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(profileSend).not.toHaveBeenCalledWith(
      { cmd: ProfileCommands.Delete },
      expect.anything()
    );
  });

  it.each([
    ['missing authenticated user', undefined, 'client-interface'],
    ['missing app scope', { userId: 'user-1' }, undefined],
  ])(
    'rejects deletion with %s before profile lookup',
    async (_reason, user, appScope) => {
      const profileSend = jest.spyOn(clientProxy, 'send');

      await expect(
        controller.deleteProfile(
          'target',
          appScope as string,
          user as UserDetails
        )
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(profileSend).not.toHaveBeenCalled();
    }
  );

  it('maps profile lookup failures to a generic fail-closed gateway error', async () => {
    const profileSend = jest
      .spyOn(clientProxy, 'send')
      .mockReturnValue(
        throwError(() => new Error('private profile details')) as any
      );

    let thrown: unknown;
    try {
      await controller.deleteProfile('target', 'client-interface', {
        userId: 'user-1',
        profileId: 'current-profile',
      } as UserDetails);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadGatewayException);
    expect((thrown as BadGatewayException).getStatus()).toBe(502);
    expect((thrown as Error).message).not.toContain('private profile details');
    expect(profileSend).not.toHaveBeenCalledWith(
      { cmd: ProfileCommands.Delete },
      expect.anything()
    );
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
