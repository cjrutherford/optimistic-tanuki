import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import {
  RegisterWorkspaceRequest,
  ActivateWorkspaceRequest,
  ResolveWorkspaceRequest,
  ResolveWorkspaceBySourceRequest,
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
    return this.workspaceService.register(request);
  }

  @MessagePattern(WorkspaceCommands.ACTIVATE)
  activate(
    @Payload() request: ActivateWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.workspaceService.activate(request);
  }

  @MessagePattern(WorkspaceCommands.RESOLVE)
  resolve(
    @Payload() request: ResolveWorkspaceRequest
  ): Promise<ResolvedWorkspace> {
    return this.workspaceService.resolve(request);
  }

  @MessagePattern(WorkspaceCommands.RESOLVE_BY_SOURCE)
  resolveBySource(
    @Payload() request: ResolveWorkspaceBySourceRequest
  ): Promise<ResolvedWorkspace> {
    return this.workspaceService.resolveBySource(request);
  }
}
