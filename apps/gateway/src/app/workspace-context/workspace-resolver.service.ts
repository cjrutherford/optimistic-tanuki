import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, WorkspaceCommands } from '@optimistic-tanuki/constants';
import {
  isResolvedWorkspace,
  ResolvedWorkspace,
  WorkspaceKind,
  WorkspaceSource,
  workspaceScopeName,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WorkspaceResolverService {
  constructor(
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy
  ) {}

  async resolveActive(
    kind: WorkspaceKind,
    slug: string
  ): Promise<ResolvedWorkspace> {
    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.RESOLVE, {
        kind,
        slug,
        requireActive: true,
      })
    );

    if (!isResolvedWorkspace(workspace)) {
      throw new ServiceUnavailableException(
        'Workspace service returned an invalid identity context'
      );
    }

    return workspace;
  }

  async resolveContext(
    appScope: string,
    kind: WorkspaceKind,
    slug: string
  ): Promise<{ workspace: ResolvedWorkspace; workspaceScope: string }> {
    const workspace = await this.resolveActive(kind, slug);
    if (workspace.appScope !== appScope) {
      throw new ForbiddenException(
        'Workspace does not belong to this app scope'
      );
    }
    return {
      workspace,
      workspaceScope: workspaceScopeName(workspace.workspaceId),
    };
  }

  async resolveContextBySource(
    appScope: string,
    kind: WorkspaceKind,
    source: WorkspaceSource
  ): Promise<{ workspace: ResolvedWorkspace; workspaceScope: string }> {
    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.RESOLVE_BY_SOURCE, {
        source,
        requireActive: true,
      })
    );
    if (!isResolvedWorkspace(workspace)) {
      throw new ServiceUnavailableException(
        'Workspace service returned an invalid identity context'
      );
    }
    if (workspace.appScope !== appScope || workspace.kind !== kind) {
      throw new ForbiddenException(
        'Workspace does not belong to this app scope'
      );
    }
    return {
      workspace,
      workspaceScope: workspaceScopeName(workspace.workspaceId),
    };
  }
}
