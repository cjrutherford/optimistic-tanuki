import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
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
} from '@optimistic-tanuki/constants';
import {
  AssignRoleDto,
  CommunityMembershipStatus,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

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
    private readonly permissionsClient: ClientProxy
  ) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all locality-based communities' })
  @ApiResponse({ status: 200, description: 'Array of locality communities.' })
  async listCommunities(@AppScope() appScope: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.LIST_LOCALITY },
          { appScope }
        )
      );
    } catch (error) {
      this.logger.error('Failed to list communities:', error);
      return [];
    }
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a locality community by slug' })
  @ApiResponse({ status: 200, description: 'Community.' })
  async findCommunity(@Param('slug') slug: string) {
    try {
      return await firstValueFrom(
        this.socialClient.send({ cmd: CommunityCommands.FIND_BY_SLUG }, { slug })
      );
    } catch (error) {
      this.logger.error('Failed to find community %s:', slug, error);
      return null;
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
  @UseGuards(AuthGuard, PermissionsGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard, PermissionsGuard)
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
  @UseGuards(AuthGuard, PermissionsGuard)
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
  @UseGuards(AuthGuard, PermissionsGuard)
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
            assignment.role?.id === role.id && assignment.targetId === communityId
        )
        : false;

      if (alreadyAssigned) {
        return;
      }

      await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.Assign },
          {
            roleId: role.id,
            profileId,
            appScopeId: role.appScope?.id || appScope,
            targetId: communityId,
          } as AssignRoleDto
        )
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
