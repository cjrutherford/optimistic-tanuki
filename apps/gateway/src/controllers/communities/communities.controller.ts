import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CommunityCommands,
  RoleCommands,
  ServiceTokens,
  AppScopeCommands,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import {
  AssignRoleDto,
  CommunityMembershipStatus,
  CommunityMemberRole,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityMemberDto,
  InviteToCommunityDto,
  workspaceScopeName,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';
import { WorkspaceContext } from '../../decorators/workspace-context.decorator';

@ApiTags('communities')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('communities')
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);
  private readonly localHubCommunityPosterRole = 'local_hub_community_poster';

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all locality-based communities' })
  @ApiResponse({ status: 200, description: 'Array of locality communities.' })
  async listCommunities(
    @AppScope() appScope: string,
    @Query('localityType') localityType?: string
  ) {
    try {
      const scopeForQuery = appScope === 'owner-console' ? undefined : appScope;
      const community = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.LIST_LOCALITY },
          { appScope: scopeForQuery, localityType }
        )
      );
      return community;
    } catch (error) {
      this.logger.error('Failed to list communities:', error);
      return [];
    }
  }

  private async provisionCommunityWorkspace(
    community: { id: string; slug?: string; name: string },
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
        source: { service: 'social', sourceId: community.id },
      })
    );
    const name = workspaceScopeName(active.workspaceId);
    let scope = await firstValueFrom(
      this.permissionsClient.send({ cmd: AppScopeCommands.GetByName }, { name })
    );
    if (!scope)
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
    const role = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetByName },
        { name: 'community_owner', appScope }
      )
    );
    if (!scope?.id || !role?.id)
      throw new Error(
        'Community workspace owner permissions are not configured'
      );
    await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.Assign },
        { roleId: role.id, profileId: user.profileId, appScopeId: scope.id }
      )
    );
  }

  // Public so the route never 401s for an anonymous caller (it just returns
  // no communities), but the class-level AuthGuard still runs to OPTIONALLY
  // attach a signature-verified `request.user`. We read the userId from that
  // guard-verified context — never from the `@User()` decorator, which
  // decodes the token WITHOUT verifying its signature and would let a forged
  // userId return another user's private community memberships.
  @Public()
  @Get('my')
  @ApiOperation({ summary: 'Get communities for current user' })
  @ApiResponse({ status: 200, description: 'Array of user communities.' })
  async getMyCommunities(@Req() req: { user?: { userId?: string } }) {
    try {
      if (!req.user?.userId) {
        return [];
      }
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.GET_USER_COMMUNITIES },
          { userId: req.user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Failed to get user communities:', error);
      return [];
    }
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('community.create')
  @ApiOperation({ summary: 'Create a new community' })
  @ApiResponse({ status: 201, description: 'Community created.' })
  async createCommunity(
    @Body() createCommunityDto: CreateCommunityDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.debug(
        `Creating community with userId=${user.userId}, profileId=${user.profileId}, appScope=${appScope}`
      );
      const community = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.CREATE },
          {
            dto: {
              ...createCommunityDto,
              appScope,
              ownerId: user.userId,
              ownerProfileId: user.profileId,
            },
            userId: user.userId,
            profileId: user.profileId,
            appScope,
          }
        )
      );
      await this.provisionCommunityWorkspace(community, user, appScope);
      return community;
    } catch (error) {
      this.logger.error('Failed to create community:', error);
      throw error;
    }
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a locality community by slug' })
  @ApiResponse({ status: 200, description: 'Community.' })
  async findCommunity(@Param('slug') slug: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.FIND_BY_SLUG },
          { slug }
        )
      );
    } catch (error) {
      this.logger.error('Failed to find community %s:', slug, error);
      return null;
    }
  }

  @Public()
  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a community by ID' })
  @ApiResponse({ status: 200, description: 'Community.' })
  async getCommunity(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send({ cmd: CommunityCommands.FIND }, { id })
      );
    } catch (error) {
      this.logger.error('Failed to get community %s:', id, error);
      return null;
    }
  }

  @Put(':id')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.update')
  @ApiOperation({ summary: 'Update a community' })
  @ApiResponse({ status: 200, description: 'Community updated.' })
  async updateCommunity(
    @Param('id') id: string,
    @Body() updateCommunityDto: UpdateCommunityDto,
    @User() user: UserDetails
  ) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.UPDATE },
          {
            id,
            dto: updateCommunityDto,
            userId: user.userId,
          }
        )
      );
    } catch (error) {
      this.logger.error('Failed to update community %s:', id, error);
      throw error;
    }
  }

  @Delete(':id')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.delete')
  @ApiOperation({ summary: 'Delete a community' })
  @ApiResponse({ status: 200, description: 'Community deleted.' })
  async deleteCommunity(@Param('id') id: string, @User() user: UserDetails) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.DELETE },
          { id, userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Failed to delete community %s:', id, error);
      throw error;
    }
  }

  @Get(':id/members')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get community members' })
  @ApiResponse({ status: 200, description: 'Array of community members.' })
  async getMembers(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.GET_MEMBERS },
          { communityId: id }
        )
      );
    } catch (error) {
      this.logger.error('Failed to get members for community %s:', id, error);
      return [];
    }
  }

  @Put(':id/members/:memberId/role')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Member role updated.' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: CommunityMemberRole },
    @User() user: UserDetails
  ) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: 'UPDATE_COMMUNITY_MEMBER_ROLE' },
          {
            communityId: id,
            memberId,
            role: body.role,
            userId: user.userId,
          }
        )
      );
    } catch (error) {
      this.logger.error('Failed to update member role:', error);
      if (
        (error as { message?: string })?.message ===
        'Cannot change the owner role'
      ) {
        throw new ConflictException('Cannot change the owner role');
      }
      throw error;
    }
  }

  @Delete(':id/members/:memberId')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.member.remove')
  @ApiOperation({ summary: 'Remove member from community' })
  @ApiResponse({ status: 200, description: 'Member removed.' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @User() user: UserDetails
  ) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.REMOVE_MEMBER },
          { communityId: id, memberId, userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Failed to remove member:', error);
      throw error;
    }
  }

  @Post(':id/members/invite')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.invite')
  @ApiOperation({ summary: 'Invite user to community' })
  @ApiResponse({ status: 201, description: 'User invited.' })
  async inviteMember(
    @Param('id') id: string,
    @Body() body: { inviteeUserId: string },
    @User() user: UserDetails
  ) {
    try {
      const inviteDto: InviteToCommunityDto = {
        communityId: id,
        inviteeUserId: body.inviteeUserId,
      };
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.INVITE },
          { dto: inviteDto, inviterId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Failed to invite member:', error);
      throw error;
    }
  }

  @Public()
  @Get(':id/sub-communities')
  @ApiOperation({ summary: 'Get sub-communities of a locality community' })
  @ApiResponse({ status: 200, description: 'Array of sub-communities.' })
  async getSubCommunities(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.GET_SUB_COMMUNITIES },
          { parentId: id }
        )
      );
    } catch (error) {
      this.logger.error('Failed to get sub-communities for %s:', id, error);
      return [];
    }
  }

  @Public()
  @Get(':id/manager')
  @ApiOperation({ summary: 'Get elected manager for a community' })
  @ApiResponse({ status: 200, description: 'Community manager or null.' })
  getCommunityManager(@Param('id') id: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_MANAGER },
        { communityId: id }
      )
    ).catch(() => null);
  }

  @Public()
  @Get(':id/election')
  @ApiOperation({ summary: 'Get active election for a community' })
  @ApiResponse({ status: 200, description: 'Active election or null.' })
  getCommunityElection(@Param('id') id: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_ELECTION },
        { communityId: id }
      )
    ).catch(() => null);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  @ApiResponse({ status: 201, description: 'Successfully joined.' })
  async joinCommunity(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    const member = await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.JOIN },
        {
          dto: { communityId: id },
          userId: user.userId,
          profileId: user.profileId,
        }
      )
    );

    if (member?.status === CommunityMembershipStatus.APPROVED) {
      await this.assignCommunityPostingRole(user.profileId, id, appScope);
    }

    return member;
  }

  @Delete(':id/membership')
  @ApiOperation({ summary: 'Leave a community' })
  @ApiResponse({ status: 200, description: 'Successfully left.' })
  async leaveCommunity(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.LEAVE },
        { communityId: id, userId: user.userId }
      )
    );

    await this.unassignCommunityPostingRole(user.profileId, id, appScope);
  }

  @Get(':id/membership')
  @ApiOperation({ summary: 'Check if authenticated user is a member' })
  @ApiResponse({ status: 200, description: 'Boolean membership status.' })
  checkMembership(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: 'IS_COMMUNITY_MEMBER' },
        { communityId: id, userId: user.userId }
      )
    );
  }

  @Post(':id/election')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Start an election for community manager' })
  @ApiResponse({ status: 201, description: 'Election started.' })
  startElection(
    @Param('id') id: string,
    @Body() body: { endsAt?: Date },
    @User() user: UserDetails
  ) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.START_ELECTION },
        { communityId: id, initiatedBy: user.userId, endsAt: body.endsAt }
      )
    );
  }

  @Post(':id/election/nominate')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  @ApiOperation({ summary: 'Nominate self for community manager' })
  @ApiResponse({ status: 201, description: 'Nominated as candidate.' })
  nominateForElection(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.NOMINATE },
        { communityId: id, userId: user.userId, profileId: user.profileId }
      )
    );
  }

  @Post(':id/election/vote')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  @ApiOperation({ summary: 'Vote for a candidate' })
  @ApiResponse({ status: 201, description: 'Vote recorded.' })
  voteInElection(
    @Param('id') id: string,
    @Body() body: { candidateId: string },
    @User() user: UserDetails
  ) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.VOTE },
        {
          communityId: id,
          voterId: user.userId,
          voterProfileId: user.profileId,
          candidateId: body.candidateId,
        }
      )
    );
  }

  @Post(':id/election/close')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Close the election and declare winner' })
  @ApiResponse({ status: 200, description: 'Election closed.' })
  closeElection(@Param('id') id: string, @Body() body: { electionId: string }) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.CLOSE_ELECTION },
        { electionId: body.electionId }
      )
    );
  }

  @Post(':id/manager')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Appoint a community manager' })
  @ApiResponse({ status: 201, description: 'Manager appointed.' })
  appointManager(
    @Param('id') id: string,
    @Body() body: { userId: string; profileId: string },
    @User() user: UserDetails
  ) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.APPOINT_MANAGER },
        { communityId: id, userId: body.userId, profileId: body.profileId }
      )
    );
  }

  @Delete(':id/manager')
  @WorkspaceContext({
    kind: 'community',
    source: 'params',
    path: 'id',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Revoke community manager' })
  @ApiResponse({ status: 200, description: 'Manager revoked.' })
  revokeManager(@Param('id') id: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.REVOKE_MANAGER },
        { communityId: id }
      )
    );
  }

  private async assignCommunityPostingRole(
    profileId: string,
    communityId: string,
    appScope: string
  ): Promise<void> {
    if (appScope !== 'local-hub') {
      return;
    }

    try {
      const role = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetByName },
          { name: this.localHubCommunityPosterRole, appScope }
        )
      );

      if (!role) {
        this.logger.warn(
          `Role ${this.localHubCommunityPosterRole} was not found for scope ${appScope}`
        );
        return;
      }

      const existingAssignments = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScope }
        )
      );

      const alreadyAssigned = Array.isArray(existingAssignments)
        ? existingAssignments.some(
            (assignment: any) =>
              assignment.role?.id === role.id &&
              assignment.targetId === communityId
          )
        : false;

      if (alreadyAssigned) {
        return;
      }

      await firstValueFrom(
        this.permissionsClient.send({ cmd: RoleCommands.Assign }, {
          roleId: role.id,
          profileId,
          appScopeId: role.appScope?.id || appScope,
          targetId: communityId,
        } as AssignRoleDto)
      );
    } catch (error) {
      this.logger.error(
        `Failed to assign ${this.localHubCommunityPosterRole} for community ${communityId}: ${error}`
      );
    }
  }

  private async unassignCommunityPostingRole(
    profileId: string,
    communityId: string,
    appScope: string
  ): Promise<void> {
    if (appScope !== 'local-hub') {
      return;
    }

    try {
      const role = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetByName },
          { name: this.localHubCommunityPosterRole, appScope }
        )
      );

      if (!role) {
        return;
      }

      await firstValueFrom(
        this.permissionsClient.send(
          { cmd: 'Unassign:Role:ByTarget' },
          {
            profileId,
            roleId: role.id,
            appScopeId: role.appScope?.id || appScope,
            targetId: communityId,
          }
        )
      );
    } catch (error) {
      this.logger.error(
        `Failed to unassign ${this.localHubCommunityPosterRole} for community ${communityId}: ${error}`
      );
    }
  }
}
