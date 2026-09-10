import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';

const app = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'North Star',
  workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  appInstanceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  appScope: 'configurable-client',
  release: {
    status: 'published',
    publishedVersion: 2,
    publishedSnapshot: {
      name: 'North Star',
      description: 'A public client doorway',
      domain: 'north-star.example.test',
      accessPolicy: 'joinable',
      landingPage: { layout: 'single-column', sections: [] },
      routes: [],
      features: {},
      theme: {},
      active: true,
    },
    history: [
      {
        version: 2,
        action: 'publish',
        snapshot: {
          name: 'North Star',
          description: 'A public client doorway',
          domain: 'north-star.example.test',
          accessPolicy: 'joinable',
          landingPage: { layout: 'single-column', sections: [] },
          routes: [],
          features: {},
          theme: {},
          active: true,
        },
      },
    ],
  },
} as unknown as AppConfigurationEntity;

describe('ConfigurationsService P11 discovery and membership', () => {
  let service: ConfigurationsService;
  let configRepository: any;
  let membershipRepository: any;

  beforeEach(async () => {
    configRepository = {
      find: jest.fn().mockResolvedValue([app]),
      manager: {
        transaction: jest.fn(async (callback: any) =>
          callback({
            getRepository: (type: unknown) =>
              type === AppConfigurationEntity
                ? configRepository
                : membershipRepository,
          })
        ),
      },
    };
    membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
      save: jest.fn(async (entity: any) => entity),
    };

    const module = await Test.createTestingModule({
      providers: [
        ConfigurationsService,
        {
          provide: getRepositoryToken(AppConfigurationEntity),
          useValue: configRepository,
        },
        { provide: getRepositoryToken(AppInstanceEntity), useValue: {} },
        {
          provide: getRepositoryToken(AppMembershipEntity),
          useValue: membershipRepository,
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(ConfigurationsService);
  });

  it('lists only confirmed active published snapshots and exposes access policy', async () => {
    const results = await (service as any).discoverPublishedApps();

    expect(results).toEqual([
      expect.objectContaining({
        appId: app.id,
        name: 'North Star',
        accessPolicy: 'joinable',
        publishedVersion: 2,
        membershipStatus: null,
      }),
    ]);
    expect(results[0]).not.toHaveProperty('workspaceId');
    expect(results[0]).not.toHaveProperty('appInstanceId');
    expect(results[0]).not.toHaveProperty('appScope');
    expect(results[0]).not.toHaveProperty('membershipId');
  });

  it('joins a joinable app idempotently for the verified profile', async () => {
    const result = await (service as any).joinPublishedApp(app.id, {
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'active', role: 'member' })
    );
    expect(membershipRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appInstanceId: app.appInstanceId,
        profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        status: 'active',
      })
    );
  });

  it('does not disclose an unpublished or private app through direct access', async () => {
    configRepository.find.mockResolvedValueOnce([
      {
        ...app,
        release: {
          ...app.release,
          publishedSnapshot: {
            ...app.release.publishedSnapshot,
            accessPolicy: 'private',
          },
        },
      },
    ]);

    await expect(
      (service as any).resolvePublishedApp(app.id, null)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps a denied app membership unavailable and does not offer another request', async () => {
    membershipRepository.findOne.mockResolvedValueOnce({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      appInstanceId: app.appInstanceId,
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      role: 'member',
      status: 'denied',
    });

    const [result] = await service.discoverPublishedApps({
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });

    expect(result).toEqual(
      expect.objectContaining({
        membershipStatus: 'denied',
        canOpen: false,
        canJoin: false,
        canRequest: false,
      })
    );
  });

  it('recovers a concurrent unique conflict after the transaction rolls back', async () => {
    const transactionalMemberships = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    configRepository.manager.transaction.mockImplementationOnce(
      async (callback: any) =>
        callback({ getRepository: () => transactionalMemberships })
    );
    membershipRepository.findOne.mockResolvedValueOnce({
      appInstanceId: app.appInstanceId,
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      role: 'member',
      status: 'active',
    });

    await expect(
      (service as any).joinPublishedApp(app.id, {
        userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      })
    ).resolves.toEqual(expect.objectContaining({ status: 'active' }));
    expect(transactionalMemberships.findOne).toHaveBeenCalledWith({
      where: {
        appInstanceId: app.appInstanceId,
        profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      },
    });
    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: {
        appInstanceId: app.appInstanceId,
        profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      },
    });
  });

  it('does not disclose a membership when the unique profile belongs to another user', async () => {
    membershipRepository.findOne.mockResolvedValueOnce({
      appInstanceId: app.appInstanceId,
      userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      role: 'member',
      status: 'active',
    });

    await expect(
      (service as any).joinPublishedApp(app.id, {
        userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        profileId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(membershipRepository.save).not.toHaveBeenCalled();
  });

  it('does not reuse a membership from one discovered app instance for another', async () => {
    const otherApp = {
      ...app,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Other app',
      appInstanceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      release: {
        ...app.release,
        publishedSnapshot: {
          ...app.release.publishedSnapshot,
          name: 'Other app',
          accessPolicy: 'joinable',
        },
        history: app.release.history.map((entry: any) => ({
          ...entry,
          snapshot: {
            ...entry.snapshot,
            name: 'Other app',
            accessPolicy: 'joinable',
          },
        })),
      },
    } as unknown as AppConfigurationEntity;
    const identity = {
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      profileId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    };
    configRepository.find.mockResolvedValueOnce([app, otherApp]);
    membershipRepository.findOne.mockImplementation(async ({ where }: any) =>
      where.appInstanceId === app.appInstanceId
        ? {
            id: '11111111-1111-4111-8111-111111111111',
            appInstanceId: app.appInstanceId,
            userId: identity.userId,
            profileId: identity.profileId,
            role: 'member',
            status: 'active',
          }
        : null
    );

    const results = await service.discoverPublishedApps(identity);

    expect(results).toEqual([
      expect.objectContaining({
        appId: app.id,
        membershipStatus: 'active',
        canOpen: true,
        canJoin: false,
      }),
      expect.objectContaining({
        appId: otherApp.id,
        membershipStatus: null,
        canOpen: false,
        canJoin: true,
      }),
    ]);
    expect(membershipRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        appInstanceId: app.appInstanceId,
        userId: identity.userId,
        profileId: identity.profileId,
      },
    });
    expect(membershipRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        appInstanceId: otherApp.appInstanceId,
        userId: identity.userId,
        profileId: identity.profileId,
      },
    });
  });
});
