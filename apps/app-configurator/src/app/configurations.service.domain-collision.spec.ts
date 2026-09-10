import { ConflictException, Logger } from '@nestjs/common';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';

describe('ConfigurationsService committed domain collision checks', () => {
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
  const stable = {
    name: 'Stable',
    description: '',
    domain: 'stable.example.com',
    landingPage: { sections: [], layout: 'single-column' },
    routes: [],
    features: {},
    theme: {},
    active: true,
  };
  const ownerConfig = (overrides: Record<string, unknown> = {}) => ({
    id: '66666666-6666-4666-8666-666666666666',
    ...context,
    name: 'Draft',
    domain: 'stable.example.com',
    landingPage: stable.landingPage,
    routes: [],
    features: {},
    theme: {},
    active: true,
    revision: 2,
    release: {
      status: 'draft',
      publishedVersion: null,
      publishedSnapshot: null,
      history: [],
    },
    ...overrides,
  });
  const competitor = {
    id: '77777777-7777-4777-8777-777777777777',
    release: {
      status: 'published',
      publishedVersion: 1,
      publishedSnapshot: stable,
      history: [
        {
          version: 1,
          action: 'publish',
          releaseNotes: 'Stable',
          snapshot: stable,
        },
      ],
    },
  };

  function createService(config: unknown) {
    const configRepository: any = {
      findOne: jest.fn().mockResolvedValue(config),
      find: jest.fn().mockResolvedValue([config, competitor]),
      query: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const appInstanceRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: context.appInstanceId,
        ...context,
        status: 'active',
      }),
    };
    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue({
        ...context,
        userId: context.ownerUserId,
        profileId: context.ownerProfileId,
        role: 'owner',
        status: 'active',
      }),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === AppConfigurationEntity
          ? configRepository
          : entity === AppInstanceEntity
          ? appInstanceRepository
          : membershipRepository,
    };
    configRepository.manager = {
      transaction: (work: (tx: any) => Promise<unknown>) => work(manager),
    };
    return {
      service: new ConfigurationsService(
        configRepository,
        appInstanceRepository as any,
        membershipRepository as any,
        { log: jest.fn(), warn: jest.fn() } as unknown as Logger
      ),
      configRepository,
      config,
    };
  }

  it('rejects publishing a draft whose committed domain belongs to another release', async () => {
    const { service, configRepository } = createService(
      ownerConfig({
        release: {
          status: 'changes-pending',
          publishedVersion: 1,
          publishedSnapshot: { ...stable, domain: 'old.example.com' },
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'Old',
              snapshot: { ...stable, domain: 'old.example.com' },
            },
          ],
        },
      })
    );
    await expect(
      service.publishConfiguration(
        (ownerConfig() as any).id,
        { expectedRevision: 2, releaseNotes: 'Colliding' },
        context
      )
    ).rejects.toThrow(ConflictException);
    expect(configRepository.query.mock.invocationCallOrder[0]).toBeLessThan(
      configRepository.find.mock.invocationCallOrder[0]
    );
    expect(configRepository.update).not.toHaveBeenCalled();
  });

  it('rejects rollback when the restored committed domain belongs to another release', async () => {
    const rollbackTarget = { ...stable, domain: 'stable.example.com' };
    const { service, configRepository } = createService(
      ownerConfig({
        release: {
          status: 'published',
          publishedVersion: 2,
          publishedSnapshot: { ...stable, domain: 'draft.example.com' },
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'Target',
              snapshot: rollbackTarget,
            },
            {
              version: 2,
              action: 'publish',
              releaseNotes: 'Draft',
              snapshot: { ...stable, domain: 'draft.example.com' },
            },
          ],
        },
      })
    );
    await expect(
      service.rollbackConfiguration(
        (ownerConfig() as any).id,
        { expectedRevision: 2, version: 1, releaseNotes: 'Colliding restore' },
        context
      )
    ).rejects.toThrow(ConflictException);
    expect(configRepository.update).not.toHaveBeenCalled();
  });
});
