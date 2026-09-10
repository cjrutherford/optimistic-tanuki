import { Controller, HttpException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import {
  RegisterWorkspaceRequest,
  ActivateWorkspaceRequest,
  ResolveWorkspaceRequest,
  ResolveWorkspaceBySourceRequest,
  ListOwnedWorkspacesRequest,
  ResolveOwnedWorkspaceRequest,
  ResolvedWorkspace,
} from '@optimistic-tanuki/models';
import { WorkspaceService } from './services/workspace.service';

@Controller()
export class AppController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @MessagePattern(WorkspaceCommands.REGISTER)
  register(
    @Payload() request: RegisterWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.forward(() => this.workspaceService.register(request));
  }

  @MessagePattern(WorkspaceCommands.ACTIVATE)
  activate(
    @Payload() request: ActivateWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.forward(() => this.workspaceService.activate(request));
  }

  @MessagePattern(WorkspaceCommands.RESOLVE)
  resolve(
    @Payload() request: ResolveWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.forward(() => this.workspaceService.resolve(request));
  }

  @MessagePattern(WorkspaceCommands.RESOLVE_BY_SOURCE)
  resolveBySource(
    @Payload() request: ResolveWorkspaceBySourceRequest
  ): Promise<ResolvedWorkspace> {
    return this.forward(() => this.workspaceService.resolveBySource(request));
  }

  @MessagePattern(WorkspaceCommands.LIST_OWNED)
  listOwned(
    @Payload() request: ListOwnedWorkspacesRequest
  ): Promise<ResolvedWorkspace[]> {
    return this.forward(() => this.workspaceService.listOwned(request));
  }

  @MessagePattern(WorkspaceCommands.RESOLVE_OWNED)
  resolveOwned(
    @Payload() request: ResolveOwnedWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.forward(() => this.workspaceService.resolveOwned(request));
  }

  private async forward<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw new RpcException(error.getResponse());
      }
      throw error;
    }
  }
}
