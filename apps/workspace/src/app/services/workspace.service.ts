import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  RegisterWorkspaceRequest,
  ActivateWorkspaceRequest,
  ResolveWorkspaceRequest,
  ResolveWorkspaceBySourceRequest,
  ListOwnedWorkspacesRequest,
  ResolveOwnedWorkspaceRequest,
  ResolvedWorkspace,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { Workspace } from '../../entities/workspace.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>
  ) {}

  async register(
    request: RegisterWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    this.requireSourceUuid(request.source.sourceId);
    const existingSource = await this.workspaceRepo.findOne({
      where: {
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
        appScope: request.appScope,
      },
    });
    if (existingSource) {
      return this.toResolvedWorkspace(existingSource);
    }

    const existing = await this.workspaceRepo.findOne({
      where: {
        kind: request.kind,
        slug: request.slug,
        appScope: request.appScope,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A workspace already uses this kind and slug'
      );
    }

    const saved = await this.workspaceRepo.save(
      this.workspaceRepo.create({
        ...request,
        status: 'draft',
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
        appScope: request.appScope,
      })
    );
    return this.toResolvedWorkspace(saved);
  }

  async resolve(request: ResolveWorkspaceRequest): Promise<ResolvedWorkspace> {
    const workspace = await this.workspaceRepo.findOne({
      where: {
        kind: request.kind,
        slug: request.slug,
        appScope: request.appScope,
      },
    });
    if (
      !workspace ||
      (request.requireActive && workspace.status !== 'active')
    ) {
      throw new NotFoundException('Workspace was not found');
    }
    return this.toResolvedWorkspace(workspace);
  }

  async resolveBySource(
    request: ResolveWorkspaceBySourceRequest
  ): Promise<ResolvedWorkspace> {
    this.requireSourceUuid(request.source.sourceId);
    const workspace = await this.workspaceRepo.findOne({
      where: {
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
        appScope: request.appScope,
      },
    });
    if (
      !workspace ||
      (request.requireActive && workspace.status !== 'active')
    ) {
      throw new NotFoundException('Workspace was not found');
    }
    return this.toResolvedWorkspace(workspace);
  }

  async listOwned(
    request: ListOwnedWorkspacesRequest
  ): Promise<ResolvedWorkspace[]> {
    const workspaces = await this.workspaceRepo.find({
      where: {
        ownerUserId: request.ownerUserId,
        ownerProfileId: request.ownerProfileId,
      },
      order: { displayName: 'ASC' },
    });
    return workspaces.map((workspace) => this.toResolvedWorkspace(workspace));
  }

  async resolveOwned(
    request: ResolveOwnedWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    if (!this.isUuid(request.workspaceId)) {
      throw new BadRequestException('Workspace ID must be a valid UUID');
    }

    const workspace = await this.workspaceRepo.findOne({
      where: {
        id: request.workspaceId,
        ownerUserId: request.ownerUserId,
        ownerProfileId: request.ownerProfileId,
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace was not found');
    }
    return this.toResolvedWorkspace(workspace);
  }

  async activate(
    request: ActivateWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    if (!this.isUuid(request.workspaceId)) {
      throw new BadRequestException('Workspace ID must be a valid UUID');
    }
    this.requireSourceUuid(request.source.sourceId);
    const workspace = await this.workspaceRepo.findOne({
      where: {
        id: request.workspaceId,
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
        appScope: request.appScope,
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace source was not found');
    }

    if (workspace.status !== 'active') {
      workspace.status = 'active';
      await this.workspaceRepo.save(workspace);
    }
    return this.toResolvedWorkspace(workspace);
  }

  private toResolvedWorkspace(workspace: Workspace): ResolvedWorkspace {
    return {
      workspaceId: workspace.id,
      kind: workspace.kind,
      slug: workspace.slug,
      displayName: workspace.displayName,
      appScope: workspace.appScope,
      ownerUserId: workspace.ownerUserId,
      ownerProfileId: workspace.ownerProfileId,
      status: workspace.status,
      source: {
        service: workspace.sourceService,
        sourceId: workspace.sourceId,
      },
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private requireSourceUuid(sourceId: string): void {
    if (!this.isUuid(sourceId)) {
      throw new BadRequestException('Workspace source ID must be a valid UUID');
    }
  }
}
