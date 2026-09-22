import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AppScopeCommands,
  RoleCommands,
  ServiceTokens,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { workspaceScopeName } from '@optimistic-tanuki/models';
import { UserDetails } from '../../decorators/user.decorator';

export type ProvisionedCommunity = {
  id: string;
  slug?: string | null;
  name: string;
};

/**
 * Shared community workspace provisioning saga (G2a).
 *
 * Extracted verbatim from the duplicated `provisionCommunityWorkspace`
 * private methods in `communities.controller.ts` and
 * `social/community.controller.ts`: register + activate the workspace, ensure
 * the permission scope, and assign the `community_owner` role. The
 * social controller's extra `community_manager` assignment stays at its call
 * site — it is route-specific behavior, not shared core.
 *
 * The injected workspace/permissions clients are the composition-gated
 * proxies, so disabling either service fails provisioning exactly as before.
 */
@Injectable()
export class CommunityWorkspaceProvisioner {
  constructor(
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy
  ) {}

  async provision(
    community: ProvisionedCommunity,
    user: UserDetails,
    appScope: string
  ): Promise<void> {
    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.REGISTER, {
        kind: 'community',
        slug: community.slug || community.id,
        displayName: community.name,
        appScope,
        ownerUserId: user.userId,
        ownerProfileId: user.profileId,
        source: { service: 'social', sourceId: community.id },
      })
    );
    const active = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.ACTIVATE, {
        workspaceId: workspace.workspaceId,
        appScope,
        source: { service: 'social', sourceId: community.id },
      })
    );
    const name = workspaceScopeName(active.workspaceId);
    let scope = await firstValueFrom(
      this.permissionsClient.send({ cmd: AppScopeCommands.GetByName }, { name })
    );
    if (!scope) {
      scope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.Create },
          {
            name,
            description: 'Community workspace permission scope',
            active: true,
          }
        )
      );
    }
    const role = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetByName },
        { name: 'community_owner', appScope: 'community' }
      )
    );
    if (!scope?.id || !role?.id) {
      throw new Error(
        'Community workspace owner permissions are not configured'
      );
    }
    await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.Assign },
        { roleId: role.id, profileId: user.profileId, appScopeId: scope.id }
      )
    );
  }
}
