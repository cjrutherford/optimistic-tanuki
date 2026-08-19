import {
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
    const existingSource = await this.workspaceRepo.findOne({
      where: {
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
      },
    });
    if (existingSource) {
      return this.toResolvedWorkspace(existingSource);
    }

    const existing = await this.workspaceRepo.findOne({
      where: { kind: request.kind, slug: request.slug },
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
      })
    );
    return this.toResolvedWorkspace(saved);
  }

  async resolve(request: ResolveWorkspaceRequest): Promise<ResolvedWorkspace> {
    const workspace = await this.workspaceRepo.findOne({
      where: { kind: request.kind, slug: request.slug },
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
    const workspace = await this.workspaceRepo.findOne({
      where: {
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
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

  async activate(
    request: ActivateWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    const workspace = await this.workspaceRepo.findOne({
      where: {
        id: request.workspaceId,
        sourceService: request.source.service,
        sourceId: request.source.sourceId,
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
}
