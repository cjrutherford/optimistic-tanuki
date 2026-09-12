import {
  BadRequestException,
  NotFoundException,
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { AppScope } from '../../../decorators/appscope.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CommentCommands,
  CommunityCommands,
  PostCommands,
  PrivacyCommands,
  ServiceTokens,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { PermissionsGuard } from '../../../guards/permissions.guard';
import {
  PermissionTarget,
  RequirePermissions,
} from '../../../decorators/permissions.decorator';
import { WorkspaceContext } from '../../../decorators/workspace-context.decorator';
import { WorkspaceContextGuard } from '../../../guards/workspace-context.guard';

export interface BlockUserDto {
  blockedId: string;
  reason?: string;
}

export interface MuteUserDto {
  mutedId: string;
  duration?: number;
}

export interface ReportContentDto {
  contentType: 'post' | 'comment' | 'profile' | 'community' | 'message';
  contentId: string;
  reason: string;
  description?: string;
}

export interface UpdateReportStatusDto {
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  adminNotes?: string;
}

export interface ModerateContentDto {
  contentType: 'post' | 'comment';
  contentId: string;
  moderationStatus: 'visible' | 'hidden';
  adminNotes?: string;
}

@UseGuards(AuthGuard)
@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  private readonly logger = new Logger(PrivacyController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy
  ) {}

  private async resolveReportWorkspaceId(
    dto: ReportContentDto,
    appScope: string
  ): Promise<string | null> {
    let communityId: string | null = null;

    if (dto.contentType === 'community') {
      const community = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.FIND },
          { id: dto.contentId }
        )
      );
      if (!community) {
        throw new BadRequestException('Reported community was not found.');
      }
      communityId = community.id;
    }

    if (dto.contentType === 'post') {
      const post = await firstValueFrom(
        this.socialClient.send(
          { cmd: PostCommands.FIND },
          { id: dto.contentId }
        )
      );
      if (!post) {
        throw new BadRequestException('Reported post was not found.');
      }
      communityId = post.communityId || null;
    }

    if (dto.contentType === 'comment') {
      const comment = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommentCommands.FIND },
          { id: dto.contentId }
        )
      );
      if (!comment) {
        throw new BadRequestException('Reported comment was not found.');
      }
      if (comment.postId) {
        const post = await firstValueFrom(
          this.socialClient.send(
            { cmd: PostCommands.FIND },
            { id: comment.postId }
          )
        );
        if (!post) {
          throw new BadRequestException('Reported comment post was not found.');
        }
        communityId = post.communityId || null;
      }
    }

    if (!communityId) {
      return null;
    }

    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.RESOLVE_BY_SOURCE, {
        appScope,
        source: { service: 'social', sourceId: communityId },
        requireActive: true,
      })
    );
    return workspace.workspaceId;
  }

  // Block endpoints
  @Post('block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully.' })
  async blockUser(
    @Body() dto: BlockUserDto,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.BLOCK_USER },
        {
          blockerId: user.profileId,
          blockedId: dto.blockedId,
          reason: dto.reason,
        }
      )
    );
  }

  @Delete('block/:blockedId')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiResponse({ status: 200, description: 'User unblocked successfully.' })
  async unblockUser(
    @Param('blockedId') blockedId: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.UNBLOCK_USER },
        { blockerId: user.profileId, blockedId }
      )
    );
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get list of blocked users' })
  @ApiResponse({
    status: 200,
    description: 'Blocked users retrieved successfully.',
  })
  async getBlockedUsers(@User() user: UserDetails): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_BLOCKED_USERS },
        { blockerId: user.profileId }
      )
    );
  }

  @Get('blocked/:userId')
  @ApiOperation({ summary: 'Check if a user is blocked' })
  @ApiResponse({
    status: 200,
    description: 'Block status checked successfully.',
  })
  async isUserBlocked(
    @Param('userId') userId: string,
    @User() user: UserDetails
  ): Promise<{ blocked: boolean }> {
    const blocked = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.IS_USER_BLOCKED },
        { blockerId: user.profileId, blockedId: userId }
      )
    );
    return { blocked };
  }

  // Mute endpoints
  @Post('mute')
  @ApiOperation({ summary: 'Mute a user' })
  @ApiResponse({ status: 201, description: 'User muted successfully.' })
  async muteUser(
    @Body() dto: MuteUserDto,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.MUTE_USER },
        {
          muterId: user.profileId,
          mutedId: dto.mutedId,
          duration: dto.duration,
        }
      )
    );
  }

  @Delete('mute/:mutedId')
  @ApiOperation({ summary: 'Unmute a user' })
  @ApiResponse({ status: 200, description: 'User unmuted successfully.' })
  async unmuteUser(
    @Param('mutedId') mutedId: string,
    @User() user: UserDetails
  ): Promise<void> {
    await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.UNMUTE_USER },
        { muterId: user.profileId, mutedId }
      )
    );
  }

  @Get('muted')
  @ApiOperation({ summary: 'Get list of muted users' })
  @ApiResponse({
    status: 200,
    description: 'Muted users retrieved successfully.',
  })
  async getMutedUsers(@User() user: UserDetails): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_MUTED_USERS },
        { muterId: user.profileId }
      )
    );
  }

  // Report endpoints
  @Post('report')
  @ApiOperation({ summary: 'Report content' })
  @ApiResponse({ status: 201, description: 'Content reported successfully.' })
  async reportContent(
    @Body() dto: ReportContentDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<any> {
    const workspaceId = await this.resolveReportWorkspaceId(dto, appScope);

    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.REPORT_CONTENT },
        {
          reporterId: user.profileId,
          contentType: dto.contentType,
          contentId: dto.contentId,
          reason: dto.reason,
          description: dto.description,
          appScope,
          workspaceId,
        }
      )
    );
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get my reports' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully.' })
  async getMyReports(@User() user: UserDetails): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_MY_REPORTS },
        { reporterId: user.profileId }
      )
    );
  }

  @Get('admin/reports')
  @WorkspaceContext({
    kind: 'community',
    source: 'query',
    path: 'communityId',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Get all content reports for moderation review' })
  async getAllReports(@Req() request: any): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_ALL_REPORTS },
        {
          workspaceId: request.workspaceContext.workspace.workspaceId,
        }
      )
    );
  }

  @Put('admin/reports/:id')
  @WorkspaceContext({
    kind: 'community',
    source: 'query',
    path: 'communityId',
    sourceService: 'social',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @PermissionTarget('query', 'communityId')
  @ApiOperation({ summary: 'Update a content report moderation status' })
  async updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @Req() request: any
  ): Promise<any> {
    const updated = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.UPDATE_REPORT_STATUS },
        {
          id,
          status: dto.status,
          adminNotes: dto.adminNotes,
          workspaceId: request.workspaceContext.workspace.workspaceId,
        }
      )
    );
    if (!updated) {
      throw new NotFoundException(
        'Content report was not found in this workspace.'
      );
    }
    return updated;
  }

  @Put('admin/moderation')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('community.manage')
  @ApiOperation({ summary: 'Apply or revert moderation to reported content' })
  async moderateContent(
    @Body() dto: ModerateContentDto,
    @User() user: UserDetails
  ): Promise<{ success: boolean }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.MODERATE_CONTENT },
        {
          contentType: dto.contentType,
          contentId: dto.contentId,
          moderationStatus: dto.moderationStatus,
          adminNotes: dto.adminNotes,
          moderatedBy: user.profileId,
        }
      )
    );
  }
}
