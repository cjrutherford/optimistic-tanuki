import { ConflictException, NotFoundException } from '@nestjs/common';
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
    sourceId: 'site-config-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let repository: jest.Mocked<Repository<Workspace>>;
  let service: WorkspaceService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Workspace>>;
    service = new WorkspaceService(repository);
  });

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
        source: { service: 'store', sourceId: 'site-config-1' },
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { kind: 'business-site', slug: 'north-star-coaching' },
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
        source: { service: 'store', sourceId: 'site-config-1' },
      })
    ).rejects.toBeInstanceOf(ConflictException);
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
        source: { service: 'store', sourceId: 'site-config-1' },
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { sourceService: 'store', sourceId: 'site-config-1' },
    });
  });

  it('resolves only active workspaces when an active context is required', async () => {
    repository.findOne.mockResolvedValue({ ...workspace, status: 'suspended' });

    await expect(
      service.resolve({
        kind: 'business-site',
        slug: 'north-star-coaching',
        requireActive: true,
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves an active workspace by its opaque source reference', async () => {
    const communityWorkspace = {
      ...workspace,
      kind: 'community' as const,
      appScope: 'social',
      sourceService: 'social' as const,
      sourceId: 'community-1',
    };
    repository.findOne.mockResolvedValue(communityWorkspace);

    await expect(
      service.resolveBySource({
        source: { service: 'social', sourceId: 'community-1' },
        requireActive: true,
      })
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { sourceService: 'social', sourceId: 'community-1' },
    });
  });

  it('activates only the workspace that matches its opaque source reference', async () => {
    repository.findOne.mockResolvedValue(workspace);
    repository.save.mockResolvedValue({ ...workspace, status: 'active' });

    await expect(
      service.activate({
        workspaceId: 'workspace-1',
        source: { service: 'store', sourceId: 'site-config-1' },
      })
    ).resolves.toEqual(expect.objectContaining({ status: 'active' }));

    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'workspace-1',
        sourceService: 'store',
        sourceId: 'site-config-1',
      },
    });
  });
});
