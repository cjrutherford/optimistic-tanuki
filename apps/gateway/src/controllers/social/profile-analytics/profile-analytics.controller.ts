import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProfileAnalyticsCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

export interface RecordViewDto {
  profileId: string;
  /** Legacy callers may still send this; authenticated account identity wins. */
  viewerId?: string;
  source: string;
}

export interface ProfileViewStatsDto {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewedAt: Date }[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNERSHIP_TIMEOUT_MS = 3000;
const OWNERSHIP_REPLY_KEYS = ['accountId', 'owned', 'profileId'];

@UseGuards(AuthGuard)
@ApiTags('profile-analytics')
@Controller('profile-analytics')
export class ProfileAnalyticsController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy
  ) {}

  private canonicalPrincipal(user: UserDetails | null): string {
    if (
      !user ||
      typeof user.userId !== 'string' ||
      !UUID_PATTERN.test(user.userId)
    ) {
      throw new UnauthorizedException('Authenticated account is required.');
    }
    return user.userId.toLowerCase();
  }

  private canonicalProfileId(profileId: unknown): string {
    if (typeof profileId !== 'string' || !UUID_PATTERN.test(profileId)) {
      throw new BadRequestException('A valid profile ID is required.');
    }
    return profileId.toLowerCase();
  }

  private async assertOwnedProfile(
    accountId: string,
    profileId: string
  ): Promise<void> {
    let reply: unknown;
    try {
      reply = await firstValueFrom(
        this.profileClient
          .send(
            { cmd: ProfileCommands.CheckAccountProfileOwnership },
            { accountId, profileId }
          )
          .pipe(timeout({ first: OWNERSHIP_TIMEOUT_MS }))
      );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to verify profile ownership.'
      );
    }

    const record =
      reply !== null &&
      typeof reply === 'object' &&
      !Array.isArray(reply) &&
      (Object.getPrototypeOf(reply) === Object.prototype ||
        Object.getPrototypeOf(reply) === null)
        ? (reply as Record<string, unknown>)
        : undefined;
    const keys = record ? Object.keys(record).sort() : [];
    if (
      !record ||
      keys.length !== OWNERSHIP_REPLY_KEYS.length ||
      keys.some((key, index) => key !== OWNERSHIP_REPLY_KEYS[index]) ||
      record.accountId !== accountId ||
      record.profileId !== profileId ||
      typeof record.owned !== 'boolean'
    ) {
      throw new ServiceUnavailableException(
        'Unable to verify profile ownership.'
      );
    }
    if (record.owned !== true) {
      throw new ForbiddenException('Profile is not owned by this account.');
    }
  }

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
        viewerId: {
          type: 'string',
          description: 'Ignored; set from authenticated account.',
        },
        source: { type: 'string' },
      },
      required: ['profileId', 'source'],
    },
  })
  async recordView(
    @Body() recordViewDto: RecordViewDto,
    @User() user: UserDetails | null
  ) {
    const accountId = this.canonicalPrincipal(user);
    const profileId = this.canonicalProfileId(recordViewDto?.profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ProfileAnalyticsCommands.RECORD_VIEW },
        { ...recordViewDto, profileId, viewerId: accountId }
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
    @Param('profileId') rawProfileId: string,
    @User() user: UserDetails | null
  ): Promise<ProfileViewStatsDto> {
    const accountId = this.canonicalPrincipal(user);
    const profileId = this.canonicalProfileId(rawProfileId);
    await this.assertOwnedProfile(accountId, profileId);
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
    @Param('profileId') rawProfileId: string,
    // Query (not path): `limit` arrives as `?limit=` — previously misdeclared
    // as a path param, so it never bound and always fell back to 10.
    @Query('limit') limit?: number | string,
    @User() user?: UserDetails | null
  ) {
    const accountId = this.canonicalPrincipal(user ?? null);
    const profileId = this.canonicalProfileId(rawProfileId);
    const parsedLimit = this.parseLimit(limit);
    await this.assertOwnedProfile(accountId, profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ProfileAnalyticsCommands.GET_RECENT_VIEWERS },
        { profileId, limit: parsedLimit }
      )
    );
  }

  private parseLimit(limit: number | string | undefined): number {
    if (limit === undefined || limit === '') return 10;
    if (
      typeof limit !== 'number' &&
      (typeof limit !== 'string' || !/^\d+$/.test(limit))
    ) {
      throw new BadRequestException('Limit must be an integer from 1 to 100.');
    }
    const parsed = typeof limit === 'number' ? limit : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException('Limit must be an integer from 1 to 100.');
    }
    return parsed;
  }
}
