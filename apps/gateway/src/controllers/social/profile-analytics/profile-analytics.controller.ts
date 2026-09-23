import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProfileAnalyticsCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

export interface RecordViewDto {
  profileId: string;
  viewerId: string;
  source: string;
}

export interface ProfileViewStatsDto {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewerId: string; viewedAt: Date }[];
}

@UseGuards(AuthGuard)
@ApiTags('profile-analytics')
@Controller('profile-analytics')
export class ProfileAnalyticsController {
  private readonly logger = new Logger(ProfileAnalyticsController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Post('view')
  @ApiOperation({ summary: 'Record a profile view' })
  @ApiResponse({
    status: 201,
    description: 'The profile view has been recorded.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        viewerId: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['profileId', 'viewerId', 'source'],
    },
  })
  async recordView(@Body() recordViewDto: RecordViewDto) {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ProfileAnalyticsCommands.RECORD_VIEW },
        recordViewDto
      )
    );
  }

  @Get(':profileId/stats')
  @ApiOperation({ summary: 'Get profile view statistics' })
  @ApiResponse({
    status: 200,
    description: 'The profile view stats have been retrieved.',
  })
  async getViewStats(
    @Param('profileId') profileId: string
  ): Promise<ProfileViewStatsDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ProfileAnalyticsCommands.GET_VIEW_STATS },
        { profileId }
      )
    );
  }

  @Get(':profileId/viewers')
  @ApiOperation({ summary: 'Get recent profile viewers' })
  @ApiResponse({
    status: 200,
    description: 'The recent viewers have been retrieved.',
  })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentViewers(
    @Param('profileId') profileId: string,
    // Query (not path): `limit` arrives as `?limit=` — previously misdeclared
    // as a path param, so it never bound and always fell back to 10.
    @Query('limit') limit?: number
  ) {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ProfileAnalyticsCommands.GET_RECENT_VIEWERS },
        { profileId, limit: limit || 10 }
      )
    );
  }
}
