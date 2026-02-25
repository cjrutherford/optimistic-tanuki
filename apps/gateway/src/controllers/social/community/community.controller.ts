import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Optional } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CommunityCommands,
  ServiceTokens,
  RoleCommands,
  ChatCommands,
} from '@optimistic-tanuki/constants';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityInviteDto,
  AssignRoleDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { AppScope } from '../../../decorators/appscope.decorator';
import { PermissionsGuard } from '../../../guards/permissions.guard';
import { RequirePermissions } from '../../../decorators/permissions.decorator';

@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('community')
@Controller('social/community')
export class CommunityController {
  private readonly logger = new Logger(CommunityController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatClient: ClientProxy
  ) {}

  @Post()
  @RequirePermissions('community.create')
  @ApiOperation({ summary: 'Create a new community' })
  @ApiResponse({
    status: 201,
    description: 'The community has been successfully created.',
    type: CommunityDto,
  })
  async createCommunity(
    @User() user: UserDetails,
    @Body() dto: CreateCommunityDto,
    @AppScope() appScope: string
  ): Promise<CommunityDto> {
    const community = await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.CREATE },
        {
          dto,
          userId: user.userId,
          profileId: user.profileId,
          appScope,
        }
      )
    );

    try {
      const communityManagerRole = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetByName },
          { name: 'community_manager', appScope }
        )
      );

      if (communityManagerRole) {
        await firstValueFrom(
          this.permissionsClient.send({ cmd: RoleCommands.Assign }, {
            roleId: communityManagerRole.id,
            profileId: user.profileId,
            appScopeId: communityManagerRole.appScope?.id || appScope,
            targetId: community.id,
          } as AssignRoleDto)
        );
        this.logger.log(
          `Assigned community_manager role to profile ${user.profileId} for community ${community.id}`
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to assign community_manager role: ${err?.message || err}`
      );
    }

    try {
      const chatRoom = await firstValueFrom(
        this.chatClient.send(
          { cmd: 'CREATE_COMMUNITY_CHAT' },
          {
            communityId: community.id,
            ownerId: user.profileId,
            name: community.name,
          }
        )
      );

      if (chatRoom && chatRoom.id) {
        await firstValueFrom(
          this.socialClient.send(
            { cmd: 'SET_COMMUNITY_CHAT_ROOM' },
            { communityId: community.id, chatRoomId: chatRoom.id }
          )
        );
        community.chatRoomId = chatRoom.id;
        this.logger.log(`Created chat room for community ${community.id}`);
      }
    } catch (err) {
      this.logger.error(`Failed to create chat room: ${err?.message || err}`);
    }

    return community;
  }

  @Get('top-active')
  @ApiOperation({ summary: 'Get top active communities' })
  @ApiResponse({
    status: 200,
    description: 'The top active communities have been successfully retrieved.',
    type: [CommunityDto],
  })
  async getTopActiveCommunities(
    @Query('limit') limit?: number,
    @Query('appScope') appScope?: string
  ): Promise<CommunityDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_TOP_ACTIVE },
        { limit: limit || 10, appScope: appScope || 'social' }
      )
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a community by ID' })
  @ApiResponse({
    status: 200,
    description: 'The community has been successfully retrieved.',
    type: CommunityDto,
  })
  async getCommunity(@Param('id') id: string): Promise<CommunityDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: CommunityCommands.FIND }, { id })
    );
  }

  @Post('search')
  @ApiOperation({ summary: 'Search for communities' })
  @ApiResponse({
    status: 200,
    description: 'The communities have been successfully retrieved.',
    type: [CommunityDto],
  })
  async searchCommunities(
    @Body() criteria: SearchCommunityDto,
    @AppScope() appScope: string
  ): Promise<CommunityDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.FIND_MANY },
        { criteria, appScope }
      )
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all communities' })
  @ApiResponse({
    status: 200,
    description: 'The communities have been successfully retrieved.',
    type: [CommunityDto],
  })
  async listCommunities(
    @Query('name') name?: string,
    @AppScope() appScope?: string
  ): Promise<CommunityDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.FIND_MANY },
        { criteria: { name }, appScope }
      )
    );
  }

  @Put(':id')
  @RequirePermissions('community.update')
  @ApiOperation({ summary: 'Update a community' })
  @ApiResponse({
    status: 200,
    description: 'The community has been successfully updated.',
    type: CommunityDto,
  })
  async updateCommunity(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Body() dto: UpdateCommunityDto
  ): Promise<CommunityDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.UPDATE },
        { id, dto, userId: user.userId }
      )
    );
  }

  @Delete(':id')
  @RequirePermissions('community.delete')
  @ApiOperation({ summary: 'Delete a community' })
  @ApiResponse({
    status: 200,
    description: 'The community has been successfully deleted.',
  })
  async deleteCommunity(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.DELETE },
        { id, userId: user.userId }
      )
    );
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined the community.',
    type: CommunityMemberDto,
  })
  async joinCommunity(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<CommunityMemberDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.JOIN },
        {
          dto: { communityId: id },
          userId: user.userId,
          profileId: user.profileId,
        }
      )
    );
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a community' })
  @ApiResponse({
    status: 200,
    description: 'Successfully left the community.',
  })
  async leaveCommunity(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.LEAVE },
        { communityId: id, userId: user.userId }
      )
    );
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get community members' })
  @ApiResponse({
    status: 200,
    description: 'The members have been successfully retrieved.',
    type: [CommunityMemberDto],
  })
  async getMembers(@Param('id') id: string): Promise<CommunityMemberDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_MEMBERS },
        { communityId: id }
      )
    );
  }

  @Get('user/communities')
  @ApiOperation({ summary: 'Get user communities' })
  @ApiResponse({
    status: 200,
    description: 'The user communities have been successfully retrieved.',
    type: [CommunityDto],
  })
  async getUserCommunities(
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<CommunityDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_USER_COMMUNITIES },
        { userId: user.userId, appScope }
      )
    );
  }

  @Post(':id/invite')
  @RequirePermissions('community.invite')
  @ApiOperation({ summary: 'Invite a user to a community' })
  @ApiResponse({
    status: 201,
    description: 'Successfully sent invite.',
    type: CommunityInviteDto,
  })
  async inviteUser(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Body() dto: { inviteeUserId: string }
  ): Promise<CommunityInviteDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.INVITE },
        {
          dto: { communityId: id, inviteeUserId: dto.inviteeUserId },
          inviterId: user.userId,
        }
      )
    );
  }

  @Get(':id/invites')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Get pending invites' })
  @ApiResponse({
    status: 200,
    description: 'The pending invites have been successfully retrieved.',
    type: [CommunityInviteDto],
  })
  async getPendingInvites(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<CommunityInviteDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_PENDING_INVITES },
        { communityId: id, userId: user.userId }
      )
    );
  }

  @Get(':id/join-requests')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Get pending join requests' })
  @ApiResponse({
    status: 200,
    description: 'The pending join requests have been successfully retrieved.',
    type: [CommunityMemberDto],
  })
  async getPendingJoinRequests(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<CommunityMemberDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_PENDING_JOIN_REQUESTS },
        { communityId: id, userId: user.userId }
      )
    );
  }

  @Post('members/:memberId/approve')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Approve a community member' })
  @ApiResponse({
    status: 200,
    description: 'Successfully approved the member.',
    type: CommunityMemberDto,
  })
  async approveMember(
    @Param('memberId') memberId: string,
    @User() user: UserDetails
  ): Promise<CommunityMemberDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.APPROVE_MEMBER },
        { memberId, approverId: user.userId }
      )
    );
  }

  @Post('members/:memberId/reject')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Reject a community member' })
  @ApiResponse({
    status: 200,
    description: 'Successfully rejected the member.',
  })
  async rejectMember(
    @Param('memberId') memberId: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.REJECT_MEMBER },
        { memberId, rejecterId: user.userId }
      )
    );
  }

  @Delete('members/:memberId')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Remove a community member' })
  @ApiResponse({
    status: 200,
    description: 'Successfully removed the member.',
  })
  async removeMember(
    @Param('memberId') memberId: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.REMOVE_MEMBER },
        { memberId, removerId: user.userId }
      )
    );
  }

  @Delete('invites/:inviteId')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Cancel a community invite' })
  @ApiResponse({
    status: 200,
    description: 'Successfully cancelled the invite.',
  })
  async cancelInvite(
    @Param('inviteId') inviteId: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.CANCEL_INVITE },
        { inviteId, userId: user.userId }
      )
    );
  }

  @Post(':id/managers')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Appoint a community manager' })
  @ApiResponse({
    status: 201,
    description: 'Successfully appointed the manager.',
  })
  async appointManager(
    @Param('id') communityId: string,
    @Body() body: { profileId: string },
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<void> {
    const communityManagerRole = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetByName },
        { name: 'community_manager', appScope }
      )
    );

    if (!communityManagerRole) {
      throw new Error('community_manager role not found');
    }

    await firstValueFrom(
      this.permissionsClient.send({ cmd: RoleCommands.Assign }, {
        roleId: communityManagerRole.id,
        profileId: body.profileId,
        appScopeId: communityManagerRole.appScope?.id || appScope,
        targetId: communityId,
      } as AssignRoleDto)
    );

    this.logger.log(
      `Appointed profile ${body.profileId} as manager for community ${communityId}`
    );
  }

  @Delete(':id/managers/:profileId')
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Revoke community manager role' })
  @ApiResponse({
    status: 200,
    description: 'Successfully revoked the manager role.',
  })
  async revokeManager(
    @Param('id') communityId: string,
    @Param('profileId') profileId: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<void> {
    const communityManagerRole = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetByName },
        { name: 'community_manager', appScope }
      )
    );

    if (!communityManagerRole) {
      throw new Error('community_manager role not found');
    }

    await firstValueFrom(
      this.permissionsClient.send(
        { cmd: 'Unassign:Role:ByTarget' },
        {
          profileId,
          roleId: communityManagerRole.id,
          appScopeId: communityManagerRole.appScope?.id || appScope,
          targetId: communityId,
        }
      )
    );

    this.logger.log(
      `Revoked manager role for profile ${profileId} from community ${communityId}`
    );
  }

  @Get(':id/chat-room')
  @ApiOperation({ summary: 'Get community chat room' })
  @ApiResponse({
    status: 200,
    description: 'The community chat room',
  })
  async getChatRoom(
    @Param('id') communityId: string
  ): Promise<{ id: string } | null> {
    try {
      const result = await firstValueFrom(
        this.socialClient.send(
          { cmd: 'GET_COMMUNITY_CHAT_ROOM' },
          { communityId }
        )
      );
      return result;
    } catch (err) {
      this.logger.error(`Failed to get chat room: ${err}`);
      return null;
    }
  }
}
