import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
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
    appScope: string,
    kind: WorkspaceKind,
    slug: string
  ): Promise<ResolvedWorkspace> {
    const workspace = await this.request(WorkspaceCommands.RESOLVE, {
      appScope,
      kind,
      slug,
      requireActive: true,
    });

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
    const workspace = await this.resolveActive(appScope, kind, slug);
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
    const workspace = await this.request(WorkspaceCommands.RESOLVE_BY_SOURCE, {
      appScope,
      source,
      requireActive: true,
    });
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

  private async request<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.workspaceClient.send(pattern, payload));
    } catch (error) {
      throw toWorkspaceHttpException(error);
    }
  }
}

export function toWorkspaceHttpException(
  error: unknown,
  fallbackMessage = 'Workspace service request failed'
): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  const rpcError =
    typeof (error as any)?.getError === 'function'
      ? (error as any).getError()
      : error;
  const record =
    rpcError && typeof rpcError === 'object'
      ? (rpcError as Record<string, unknown>)
      : {};
  const nestedResponse =
    record.response && typeof record.response === 'object'
      ? (record.response as Record<string, unknown>)
      : undefined;
  const nestedError =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : undefined;
  const remote = nestedResponse ?? nestedError ?? record;
  const status = Number(
    remote.statusCode ?? remote.status ?? record.statusCode ?? record.status
  );
  const rawMessage =
    remote.message ??
    record.message ??
    (typeof rpcError === 'string' ? rpcError : undefined);
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
    ? rawMessage
    : fallbackMessage;

  const normalizedStatus =
    Number.isInteger(status) && status >= 400 && status < 600
      ? status
      : HttpStatus.SERVICE_UNAVAILABLE;

  switch (normalizedStatus) {
    case HttpStatus.BAD_REQUEST:
      return new BadRequestException(message);
    case HttpStatus.FORBIDDEN:
      return new ForbiddenException(message);
    case HttpStatus.NOT_FOUND:
      return new NotFoundException(message);
    default:
      return new HttpException(message, normalizedStatus);
  }
}
