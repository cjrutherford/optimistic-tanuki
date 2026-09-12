import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  const workspace: Workspace = {
    id: 'workspace-1',
    kind: 'business-site',
    slug: 'north-star-coaching',
    displayName: 'North Star Coaching',
    appScope: 'business-site',
    ownerUserId: 'user-1',
    ownerProfileId: 'profile-1',
    status: 'active',
    sourceService: 'store',
    sourceId: '123e4567-e89b-42d3-a456-426614174021',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let repository: jest.Mocked<Repository<Workspace>>;
  let service: WorkspaceService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Workspace>>;
    service = new WorkspaceService(repository);
  });

  it('lists only workspaces owned by the trusted user and profile pair', async () => {
    const ownedWorkspace = {
      ...workspace,
      id: '123e4567-e89b-12d3-a456-426614174000',
      ownerUserId: 'owner-user-1',
      ownerProfileId: 'owner-profile-1',
    };
    repository.find.mockResolvedValue([ownedWorkspace]);

    await expect(
      service.listOwned({
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      })
    ).resolves.toEqual([
      expect.objectContaining({ workspaceId: ownedWorkspace.id }),
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      where: {
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      },
      order: { displayName: 'ASC' },
    });
  });

  it('does not resolve a workspace that is not owned by the trusted identity', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveOwned({
        workspaceId: '123e4567-e89b-12d3-a456-426614174001',
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      },
    });
  });

  it('rejects a malformed owned workspace selector before querying a UUID column', async () => {
    await expect(
      service.resolveOwned({
        workspaceId: 'p43-a',
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('accepts a version 7 UUID when resolving an owned workspace', async () => {
    const workspaceId = '123e4567-e89b-72d3-a456-426614174020';
    repository.findOne.mockResolvedValue({ ...workspace, id: workspaceId });

    await expect(
      service.resolveOwned({
        workspaceId,
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId }));
  });

  it('rejects a malformed workspace UUID version before querying', async () => {
    await expect(
      service.resolveOwned({
        workspaceId: '123e4567-e89b-92d3-a456-426614174020',
        ownerUserId: 'owner-user-1',
        ownerProfileId: 'owner-profile-1',
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it.each([
    [
      'register',
      () =>
        service.register({
          kind: 'business-site',
          slug: 'invalid-source',
          displayName: 'Invalid',
          appScope: 'business-site',
          ownerUserId: 'user-1',
          ownerProfileId: 'profile-1',
          source: { service: 'store', sourceId: 'not-a-uuid' },
        }),
    ],
    [
      'resolve by source',
      () =>
        service.resolveBySource({
          appScope: 'business-site',
          source: { service: 'store', sourceId: 'not-a-uuid' },
        }),
    ],
    [
      'activate',
      () =>
        service.activate({
          workspaceId: '123e4567-e89b-42d3-a456-426614174020',
          appScope: 'business-site',
          source: { service: 'store', sourceId: 'not-a-uuid' },
        }),
    ],
  ])(
    'rejects a malformed source UUID before repository access during %s',
    async (_name, operation) => {
      await expect(operation()).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    }
  );

  it('registers a source-backed workspace after confirming its kind/slug is unused', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(workspace);
    repository.save.mockResolvedValue(workspace);

    await expect(
      service.register({
        kind: 'business-site',
        slug: 'north-star-coaching',
        displayName: 'North Star Coaching',
        appScope: 'business-site',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));

    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'business-site',
      },
    });
    expect(repository.save).toHaveBeenCalledWith(workspace);
  });

  it('does not duplicate a kind/slug pair', async () => {
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(workspace);

    await expect(
      service.register({
        kind: 'business-site',
        slug: 'north-star-coaching',
        displayName: 'North Star Coaching',
        appScope: 'business-site',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registers the same kind and slug independently in distinct app scopes', async () => {
    const configurableWorkspace = {
      ...workspace,
      id: 'workspace-2',
      appScope: 'configurable-client',
      sourceId: '123e4567-e89b-42d3-a456-426614174022',
    };
    repository.findOne.mockResolvedValue(null);
    repository.create
      .mockReturnValueOnce(workspace)
      .mockReturnValueOnce(configurableWorkspace);
    repository.save
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(configurableWorkspace);

    await service.register({
      kind: 'business-site',
      slug: 'shared-owner',
      displayName: 'Business Owner',
      appScope: 'business-site',
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      source: {
        service: 'store',
        sourceId: '123e4567-e89b-42d3-a456-426614174021',
      },
    });
    await service.register({
      kind: 'business-site',
      slug: 'shared-owner',
      displayName: 'Configurable Owner',
      appScope: 'configurable-client',
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      source: {
        service: 'app-configurator',
        sourceId: '123e4567-e89b-42d3-a456-426614174022',
      },
    });

    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        kind: 'business-site',
        slug: 'shared-owner',
        appScope: 'business-site',
      },
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(4, {
      where: {
        kind: 'business-site',
        slug: 'shared-owner',
        appScope: 'configurable-client',
      },
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('treats repeated registration from the same opaque source as idempotent', async () => {
    repository.findOne.mockResolvedValueOnce(workspace);

    await expect(
      service.register({
        kind: 'business-site',
        slug: 'north-star-coaching',
        displayName: 'North Star Coaching',
        appScope: 'business-site',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        sourceService: 'store',
        sourceId: '123e4567-e89b-42d3-a456-426614174021',
        appScope: 'business-site',
      },
    });
  });

  it('registers the same source UUID independently in distinct app scopes', async () => {
    const sourceId = '123e4567-e89b-42d3-a456-426614174020';
    const businessWorkspace = { ...workspace, sourceId };
    const configurableWorkspace = {
      ...workspace,
      id: 'workspace-2',
      slug: 'configurable-owner',
      appScope: 'configurable-client',
      sourceId,
    };
    repository.findOne.mockResolvedValue(null);
    repository.create
      .mockReturnValueOnce(businessWorkspace)
      .mockReturnValueOnce(configurableWorkspace);
    repository.save
      .mockResolvedValueOnce(businessWorkspace)
      .mockResolvedValueOnce(configurableWorkspace);

    await service.register({
      kind: 'business-site',
      slug: 'north-star-coaching',
      displayName: 'North Star',
      appScope: 'business-site',
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      source: { service: 'app-configurator', sourceId },
    });
    await service.register({
      kind: 'business-site',
      slug: 'configurable-owner',
      displayName: 'Configurable Owner',
      appScope: 'configurable-client',
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      source: { service: 'app-configurator', sourceId },
    });

    expect(repository.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        sourceService: 'app-configurator',
        sourceId,
        appScope: 'business-site',
      },
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(3, {
      where: {
        sourceService: 'app-configurator',
        sourceId,
        appScope: 'configurable-client',
      },
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('resolves only active workspaces when an active context is required', async () => {
    repository.findOne.mockResolvedValue({ ...workspace, status: 'suspended' });

    await expect(
      service.resolve({
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'business-site',
        requireActive: true,
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves the same kind and slug independently by app scope', async () => {
    repository.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce({
      ...workspace,
      id: 'workspace-2',
      appScope: 'configurable-client',
    });

    await service.resolve({
      kind: 'business-site',
      slug: 'north-star-coaching',
      appScope: 'business-site',
    });
    await service.resolve({
      kind: 'business-site',
      slug: 'north-star-coaching',
      appScope: 'configurable-client',
    });

    expect(repository.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'business-site',
      },
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'configurable-client',
      },
    });
  });

  it('denies slug resolution in the wrong app scope', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.resolve({
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'configurable-client',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        kind: 'business-site',
        slug: 'north-star-coaching',
        appScope: 'configurable-client',
      },
    });
  });

  it('resolves an active workspace by its opaque source reference', async () => {
    const communityWorkspace = {
      ...workspace,
      kind: 'community' as const,
      appScope: 'social',
      sourceService: 'social' as const,
      sourceId: '123e4567-e89b-42d3-a456-426614174022',
    };
    repository.findOne.mockResolvedValue(communityWorkspace);

    await expect(
      service.resolveBySource({
        appScope: 'social',
        source: {
          service: 'social',
          sourceId: '123e4567-e89b-42d3-a456-426614174022',
        },
        requireActive: true,
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        sourceService: 'social',
        sourceId: '123e4567-e89b-42d3-a456-426614174022',
        appScope: 'social',
      },
    });
  });

  it('activates only the workspace that matches its opaque source reference', async () => {
    repository.findOne.mockResolvedValue(workspace);
    repository.save.mockResolvedValue({ ...workspace, status: 'active' });

    await expect(
      service.activate({
        workspaceId: '123e4567-e89b-42d3-a456-426614174020',
        appScope: 'business-site',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).resolves.toEqual(expect.objectContaining({ status: 'active' }));

    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: '123e4567-e89b-42d3-a456-426614174020',
        sourceService: 'store',
        sourceId: '123e4567-e89b-42d3-a456-426614174021',
        appScope: 'business-site',
      },
    });
  });

  it('rejects malformed activation workspace IDs before repository access', async () => {
    await expect(
      service.activate({
        workspaceId: 'workspace-1',
        appScope: 'business-site',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('activates scoped rows sharing the same source UUID independently', async () => {
    const sourceId = '123e4567-e89b-42d3-a456-426614174021';
    const business = {
      ...workspace,
      id: '123e4567-e89b-42d3-a456-426614174020',
      status: 'draft' as const,
    };
    const configurable = {
      ...workspace,
      id: '123e4567-e89b-42d3-a456-426614174023',
      appScope: 'configurable-client',
      status: 'draft' as const,
    };
    repository.findOne
      .mockResolvedValueOnce(business)
      .mockResolvedValueOnce(configurable);
    repository.save
      .mockResolvedValueOnce({ ...business, status: 'active' })
      .mockResolvedValueOnce({ ...configurable, status: 'active' });

    await service.activate({
      workspaceId: business.id,
      appScope: 'business-site',
      source: { service: 'store', sourceId },
    });
    await service.activate({
      workspaceId: configurable.id,
      appScope: 'configurable-client',
      source: { service: 'store', sourceId },
    });

    expect(repository.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        id: business.id,
        sourceService: 'store',
        sourceId,
        appScope: 'business-site',
      },
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        id: configurable.id,
        sourceService: 'store',
        sourceId,
        appScope: 'configurable-client',
      },
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('denies activation when the source belongs to another app scope', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.activate({
        workspaceId: '123e4567-e89b-42d3-a456-426614174020',
        appScope: 'configurable-client',
        source: {
          service: 'store',
          sourceId: '123e4567-e89b-42d3-a456-426614174021',
        },
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: '123e4567-e89b-42d3-a456-426614174020',
        sourceService: 'store',
        sourceId: '123e4567-e89b-42d3-a456-426614174021',
        appScope: 'configurable-client',
      },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
