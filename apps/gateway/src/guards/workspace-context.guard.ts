import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceResolverService } from '../app/workspace-context/workspace-resolver.service';
import {
  WORKSPACE_CONTEXT_KEY,
  WorkspaceContextRequirement,
} from '../decorators/workspace-context.decorator';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { CommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: WorkspaceResolverService,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement =
      this.reflector.getAllAndOverride<WorkspaceContextRequirement>(
        WORKSPACE_CONTEXT_KEY,
        [context.getHandler(), context.getClass()]
      );
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const slug = request[requirement.source]?.[requirement.path]?.trim();
    if (!slug) {
      if (requirement.optional) return true;
      throw new BadRequestException('Workspace selector is required');
    }
    const appScope = request.headers['x-ot-appscope'];
    if (!appScope) throw new BadRequestException('App scope is required');

    const sourceId = requirement.resource
      ? (
          await firstValueFrom(
            this.socialClient.send(
              {
                cmd:
                  requirement.resource === 'member'
                    ? CommunityCommands.FIND_MEMBER
                    : CommunityCommands.FIND_INVITE,
              },
              { id: slug }
            )
          )
        )?.communityId
      : slug;
    if (!sourceId)
      throw new BadRequestException('Workspace resource was not found');
    const resolved = requirement.sourceService
      ? await this.resolver.resolveContextBySource(appScope, requirement.kind, {
          service: requirement.sourceService,
          sourceId,
        })
      : await this.resolver.resolveContext(appScope, requirement.kind, slug);
    request.workspaceContext = {
      ...resolved,
      strict: requirement.strict === true,
    };
    return true;
  }
}
