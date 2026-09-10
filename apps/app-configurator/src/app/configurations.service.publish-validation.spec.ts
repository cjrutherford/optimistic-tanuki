import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';

describe('ConfigurationsService publish validation', () => {
  const context = {
    ownerUserId: '44444444-4444-4444-8444-444444444444',
    ownerProfileId: '55555555-5555-4555-8555-555555555555',
    appScope: 'business-site',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    appInstanceId: '22222222-2222-4222-8222-222222222222',
    membershipId: '33333333-3333-4333-8333-333333333333',
    membershipRole: 'owner' as const,
    membershipStatus: 'active' as const,
  };

  it('rejects a malformed whole draft before changing the published state', async () => {
    const config = {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Malformed draft',
      workspaceId: context.workspaceId,
      appInstanceId: context.appInstanceId,
      ownerUserId: context.ownerUserId,
      ownerProfileId: context.ownerProfileId,
      appScope: context.appScope,
      description: 'Draft',
      domain: 'draft.example.com',
      // This is deliberately malformed at runtime despite the TypeScript type.
      landingPage: null,
      routes: [],
      features: {},
      theme: {},
      active: true,
      revision: 4,
      release: {
        status: 'changes-pending' as const,
        publishedVersion: 1,
        publishedSnapshot: {
          name: 'Stable v1',
          description: 'Stable',
          domain: 'stable.example.com',
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {},
          active: true,
        },
        history: [],
      },
    } as any;
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const configRepository: any = {
      manager: {
        transaction: async (work: (manager: any) => Promise<unknown>) =>
          work({
            getRepository: (entity: unknown) => {
              if (entity === AppConfigurationEntity) return configRepository;
              if (entity === AppInstanceEntity) return appInstanceRepository;
              return membershipRepository;
            },
          }),
      },
      findOne: jest.fn().mockResolvedValue(config),
      find: jest.fn().mockResolvedValue([]),
      update,
    };
    const appInstanceRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: context.appInstanceId,
        workspaceId: context.workspaceId,
        appScope: context.appScope,
        ownerUserId: context.ownerUserId,
        ownerProfileId: context.ownerProfileId,
        status: 'active',
      }),
    };
    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: context.membershipId,
        workspaceId: context.workspaceId,
        appInstanceId: context.appInstanceId,
        appScope: context.appScope,
        userId: context.ownerUserId,
        profileId: context.ownerProfileId,
        role: 'owner',
        status: 'active',
      }),
    };
    const service = new ConfigurationsService(
      configRepository as any,
      appInstanceRepository as any,
      membershipRepository as any,
      { log: jest.fn(), warn: jest.fn() } as unknown as Logger
    );

    await expect(
      service.publishConfiguration(
        config.id,
        { expectedRevision: 4, releaseNotes: 'Should fail' },
        context
      )
    ).rejects.toThrow(BadRequestException);

    expect(update).not.toHaveBeenCalled();
    expect(config.release.publishedVersion).toBe(1);
    expect(config.release.publishedSnapshot.name).toBe('Stable v1');
  });
});
