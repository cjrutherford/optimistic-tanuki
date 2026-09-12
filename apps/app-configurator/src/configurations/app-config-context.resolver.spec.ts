import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigurationsService } from '../app/configurations.service';
import { AppConfigurationEntity } from './entities/app-configuration.entity';
import { AppInstanceEntity } from './entities/app-instance.entity';
import { AppMembershipEntity } from './entities/app-membership.entity';
import type { AppConfigRequestContext } from '@optimistic-tanuki/app-config-models';

describe('app-configurator authoritative context resolution', () => {
  let service: ConfigurationsService;
  let appInstanceRepository: { findOne: jest.Mock };
  let membershipRepository: { findOne: jest.Mock };

  const request = {
    ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    appScope: 'business-site',
  };
  const appInstance: AppInstanceEntity = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    workspaceId: request.workspaceId,
    appScope: request.appScope,
    ownerUserId: request.ownerUserId,
    ownerProfileId: request.ownerProfileId,
    status: 'active',
  } as AppInstanceEntity;
  const membership: AppMembershipEntity = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    workspaceId: request.workspaceId,
    appInstanceId: appInstance.id,
    appScope: request.appScope,
    userId: request.ownerUserId,
    profileId: request.ownerProfileId,
    role: 'owner',
    status: 'active',
  } as AppMembershipEntity;

  beforeEach(async () => {
    appInstanceRepository = {
      findOne: jest.fn().mockResolvedValue(appInstance),
    };
    membershipRepository = {
      findOne: jest.fn().mockResolvedValue(membership),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationsService,
        {
          provide: getRepositoryToken(AppConfigurationEntity),
          useValue: { manager: {} },
        },
        {
          provide: getRepositoryToken(AppInstanceEntity),
          useValue: appInstanceRepository,
        },
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

  it('resolves an active owner from trusted identity, canonical workspace, and app scope', async () => {
    await expect(service.resolveContext(request)).resolves.toEqual({
      ...request,
      appInstanceId: appInstance.id,
      membershipId: membership.id,
      membershipRole: 'owner',
      membershipStatus: 'active',
    } satisfies AppConfigRequestContext);
  });

  it('rejects a missing app instance', async () => {
    appInstanceRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.resolveContext(request)).rejects.toThrow(
      NotFoundException
    );
  });

  it('rejects a foreign owner identity', async () => {
    appInstanceRepository.findOne.mockResolvedValueOnce({
      ...appInstance,
      ownerUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    await expect(service.resolveContext(request)).rejects.toThrow(
      ForbiddenException
    );
  });

  it('rejects an inactive owner membership', async () => {
    membershipRepository.findOne.mockResolvedValueOnce({
      ...membership,
      status: 'suspended',
    });

    await expect(service.resolveContext(request)).rejects.toThrow(
      ForbiddenException
    );
  });

  it('rejects an inactive app instance', async () => {
    appInstanceRepository.findOne.mockResolvedValueOnce({
      ...appInstance,
      status: 'suspended',
    });

    await expect(service.resolveContext(request)).rejects.toThrow(
      ForbiddenException
    );
    expect(membershipRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a request for the wrong app scope', async () => {
    appInstanceRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.resolveContext({ ...request, appScope: 'forum' })
    ).rejects.toThrow(NotFoundException);
  });

  it('does not accept client overrides for authoritative IDs or statuses', async () => {
    const result = await service.resolveContext({
      ...request,
      appInstanceId: '99999999-9999-4999-8999-999999999999',
      membershipId: '88888888-8888-4888-8888-888888888888',
      membershipRole: 'member',
      membershipStatus: 'active',
    } as any);

    expect(result).toEqual({
      ...request,
      appInstanceId: appInstance.id,
      membershipId: membership.id,
      membershipRole: 'owner',
      membershipStatus: 'active',
    });
  });
});
