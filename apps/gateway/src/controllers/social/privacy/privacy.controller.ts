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
  Optional,
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
  ClassifiedCommands,
  ProfileCommands,
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
import { SocialGateway } from '../../../app/social-gateway/social.gateway';
import { IdentityThrottlerGuard } from '../../learning/identity-throttler.guard';
import { gatewayWriteLimit } from '../../../app/throttler-config';
import { Throttle } from '@nestjs/throttler';

export interface BlockUserDto {
  blockedId: string;
  reason?: string;
}

export interface MuteUserDto {
  mutedId: string;
  duration?: number;
}

export interface ReportContentDto {
  contentType:
    | 'post'
    | 'comment'
    | 'profile'
    | 'community'
    | 'message'
    | 'classified'
    | 'seller';
  contentId: string;
  reason: string;
  description?: string;
}

export interface UpdateReportStatusDto {
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  adminNotes?: string;
}

export interface ModerateContentDto {
  reportId: string;
  contentType: 'post' | 'comment';
  contentId: string;
  moderationStatus: 'visible' | 'hidden';
  adminNotes?: string;
}

const REPORT_STATUSES = new Set([
  'pending',
  'reviewed',
  'actioned',
  'dismissed',
]);
const MODERATION_STATUSES = new Set(['visible', 'hidden']);
const MODERATABLE_CONTENT_TYPES = new Set(['post', 'comment']);
const REPORT_CONTENT_TYPES = new Set([
  'post',
  'comment',
  'profile',
  'community',
  'message',
  'classified',
  'seller',
]);
const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'misinformation',
  'inappropriate',
  'other',
]);
const PRIVACY_WRITE_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_PRIVACY_WRITE_LIMIT', 20, 500, 2000),
    ttl: 60000,
  },
};
const REPORT_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_REPORT_LIMIT', 10, 200, 1000),
    ttl: 60000,
  },
};

@UseGuards(AuthGuard)
@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  private readonly logger = new Logger(PrivacyController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy,
    @Optional() private readonly socialGateway?: SocialGateway,
    @Optional()
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsClient?: ClientProxy,
    @Optional()
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient?: ClientProxy
  ) {}

  private invalidateSocialContent(): void {
    this.socialGateway?.broadcastSocialContentInvalidated();
  }

  private async resolveReportWorkspaceId(
    dto: ReportContentDto,
    appScope: string,
    viewerProfileId: string
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
          { id: dto.contentId, viewerProfileId }
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
          { id: dto.contentId, viewerProfileId }
        )
      );
      if (!comment) {
        throw new BadRequestException('Reported comment was not found.');
      }
      if (comment.postId) {
        const post = await firstValueFrom(
          this.socialClient.send(
            { cmd: PostCommands.FIND },
            { id: comment.postId, viewerProfileId }
          )
        );
        if (!post) {
          throw new BadRequestException('Reported comment post was not found.');
        }
        communityId = post.communityId || null;
      }
    }

    if (dto.contentType === 'classified') {
      if (!this.classifiedsClient) {
        throw new BadRequestException(
          'Classified listing could not be verified.'
        );
      }
      const listing = await firstValueFrom(
        this.classifiedsClient.send(
          { cmd: ClassifiedCommands.FIND_BY_ID },
          { id: dto.contentId, appScope }
        )
      );
      if (!listing || listing.appScope !== appScope) {
        throw new BadRequestException('Reported listing was not found.');
      }
      return null;
    }

    if (dto.contentType === 'profile' || dto.contentType === 'seller') {
      if (!this.profileClient) {
        throw new BadRequestException(
          'Reported profile could not be verified.'
        );
      }
      const profile = await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { id: dto.contentId }
        )
      );
      if (!profile || profile.id !== dto.contentId) {
        throw new BadRequestException('Reported profile was not found.');
      }
      return null;
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
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(PRIVACY_WRITE_THROTTLE)
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully.' })
  async blockUser(
    @Body() dto: BlockUserDto,
    @User() user: UserDetails
  ): Promise<void> {
    if (!dto.blockedId?.trim() || dto.blockedId === user.profileId) {
      throw new BadRequestException('A different target profile is required.');
    }
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
    this.invalidateSocialContent();
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
    this.invalidateSocialContent();
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get list of blocked users' })
  @ApiResponse({
    status: 200,
    description: 'Blocked users retrieved successfully.',
  })
  async getBlockedUsers(@User() user: UserDetails): Promise<any[]> {
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_BLOCKED_USERS },
        { blockerId: user.profileId }
      )
    );
    return result;
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
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(PRIVACY_WRITE_THROTTLE)
  @ApiOperation({ summary: 'Mute a user' })
  @ApiResponse({ status: 201, description: 'User muted successfully.' })
  async muteUser(
    @Body() dto: MuteUserDto,
    @User() user: UserDetails
  ): Promise<void> {
    if (
      !dto.mutedId?.trim() ||
      dto.mutedId === user.profileId ||
      (dto.duration !== undefined &&
        (!Number.isSafeInteger(dto.duration) ||
          dto.duration <= 0 ||
          dto.duration > 31536000))
    ) {
      throw new BadRequestException('Invalid mute target or duration.');
    }
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
    this.invalidateSocialContent();
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
    this.invalidateSocialContent();
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
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(REPORT_THROTTLE)
  @ApiOperation({ summary: 'Report content' })
  @ApiResponse({ status: 201, description: 'Content reported successfully.' })
  async reportContent(
    @Body() dto: ReportContentDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<any> {
    if (
      !REPORT_CONTENT_TYPES.has(dto.contentType) ||
      typeof dto.contentId !== 'string' ||
      dto.contentId.trim().length === 0 ||
      !REPORT_REASONS.has(dto.reason) ||
      (dto.description !== undefined && dto.description.length > 2000)
    ) {
      throw new BadRequestException('Invalid content report request.');
    }
    if (dto.contentType === 'message') {
      throw new BadRequestException(
        'Message reports are unavailable until conversation access can be verified.'
      );
    }
    const workspaceId = await this.resolveReportWorkspaceId(
      dto,
      appScope,
      user.profileId
    );

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
  async getMyReports(
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_MY_REPORTS },
        { reporterId: user.profileId, appScope }
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
  async getAllReports(
    @Req() request: any,
    @AppScope() appScope: string
  ): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_ALL_REPORTS },
        {
          workspaceId: request.workspaceContext.workspace.workspaceId,
          appScope,
        }
      )
    );
  }

  @Get('operator/reports')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('content.report.review')
  @ApiOperation({ summary: 'List all reports within the authorized app scope' })
  async getOperatorReports(@AppScope() appScope: string): Promise<any[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.GET_ALL_REPORTS },
        { appScope }
      )
    );
  }

  @Put('operator/reports/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('content.report.review')
  @ApiOperation({ summary: 'Resolve a report within the authorized app scope' })
  async updateOperatorReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<any> {
    if (!REPORT_STATUSES.has(dto.status)) {
      throw new BadRequestException('Unsupported report status.');
    }
    const updated = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.UPDATE_REPORT_STATUS },
        {
          id,
          status: dto.status,
          adminNotes: dto.adminNotes,
          appScope,
          moderatedBy: user.profileId,
        }
      )
    );
    if (!updated) {
      throw new NotFoundException('App-wide report was not found.');
    }
    return updated;
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
    @Req() request: any,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<any> {
    if (!REPORT_STATUSES.has(dto.status)) {
      throw new BadRequestException('Unsupported report status.');
    }
    const updated = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.UPDATE_REPORT_STATUS },
        {
          id,
          status: dto.status,
          adminNotes: dto.adminNotes,
          workspaceId: request.workspaceContext.workspace.workspaceId,
          appScope,
          moderatedBy: user.profileId,
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
  @ApiOperation({ summary: 'Apply or revert moderation to reported content' })
  async moderateContent(
    @Body() dto: ModerateContentDto,
    @User() user: UserDetails,
    @Req() request: any,
    @AppScope() appScope: string
  ): Promise<{ success: boolean }> {
    if (
      !MODERATION_STATUSES.has(dto.moderationStatus) ||
      !MODERATABLE_CONTENT_TYPES.has(dto.contentType)
    ) {
      throw new BadRequestException('Unsupported content moderation request.');
    }
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.MODERATE_CONTENT },
        {
          contentType: dto.contentType,
          contentId: dto.contentId,
          reportId: dto.reportId,
          moderationStatus: dto.moderationStatus,
          adminNotes: dto.adminNotes,
          moderatedBy: user.profileId,
          workspaceId: request.workspaceContext.workspace.workspaceId,
          appScope,
        }
      )
    );
    this.invalidateSocialContent();
    return result;
  }
}
