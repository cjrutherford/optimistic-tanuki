import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrivacyCommands, ServiceTokens } from '@optimistic-tanuki/constants';

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

@UseGuards(AuthGuard)
@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  private readonly logger = new Logger(PrivacyController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

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
    @User() user: UserDetails
  ): Promise<any> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PrivacyCommands.REPORT_CONTENT },
        {
          reporterId: user.profileId,
          contentType: dto.contentType,
          contentId: dto.contentId,
          reason: dto.reason,
          description: dto.description,
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
}
