import {
  Body,
  HttpException,
  HttpStatus,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
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
  ClassifiedCommands,
  CommunityCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';
import { gatewayWriteLimit } from '../../app/throttler-config';
import { Throttle } from '@nestjs/throttler';

const CLASSIFIED_CREATE_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_CLASSIFIED_CREATE_LIMIT', 10, 200, 1000),
    ttl: 60000,
  },
};

export interface CreateClassifiedAdDto {
  communityId?: string | null;
  communitySlug?: string;
  title: string;
  description: string;
  price: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface UpdateClassifiedAdDto {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface SearchClassifiedsDto {
  communityId?: string;
  communitySlug?: string;
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

@ApiTags('classifieds')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('classifieds')
export class ClassifiedsController {
  private readonly logger = new Logger(ClassifiedsController.name);

  constructor(
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  private requireAppScope(appScope: string | null): string {
    if (!appScope?.trim()) {
      throw new HttpException(
        'Application scope is required',
        HttpStatus.BAD_REQUEST
      );
    }
    return appScope;
  }

  private async forward<T>(
    pattern: { cmd: string },
    payload: unknown,
    fallbackMessage: string
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.classifiedsClient.send<T>(pattern, payload)
      );
    } catch (error) {
      throw this.toHttpException(error, fallbackMessage);
    }
  }

  private toHttpException(
    error: unknown,
    fallbackMessage: string
  ): HttpException {
    const source = error as {
      message?: string;
      status?: number | string;
      statusCode?: number;
      error?: { message?: string; status?: number; statusCode?: number };
      response?: { message?: string; status?: number; statusCode?: number };
      getError?: () => unknown;
    };
    const rpcError =
      typeof source?.getError === 'function' ? source.getError() : source;
    const rpcSource = rpcError as typeof source;
    const remote = rpcSource?.response ?? rpcSource?.error ?? rpcSource;
    const rawMessage = remote?.message ?? rpcSource?.message ?? source?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
      ? rawMessage
      : fallbackMessage;
    const status = Number(
      remote?.statusCode ??
        remote?.status ??
        rpcSource?.statusCode ??
        rpcSource?.status
    );
    const inferredStatus =
      typeof message === 'string' && message.startsWith('Forbidden:')
        ? HttpStatus.FORBIDDEN
        : typeof message === 'string' && message.includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code =
      Number.isInteger(status) && status >= 400 && status < 600
        ? status
        : inferredStatus;
    return new HttpException(message || fallbackMessage, code);
  }

  private async resolveCommunitySlugToId(slug: string): Promise<string | null> {
    try {
      const community = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommunityCommands.FIND_BY_SLUG },
          { slug }
        )
      );
      return community?.id || null;
    } catch (error) {
      this.logger.warn(`Failed to resolve community slug "${slug}":`, error);
      return null;
    }
  }

  // ─── Public read endpoints ────────────────────────────────────────────────

  @Public()
  @Get('community/:communityId')
  @ApiOperation({ summary: 'List all classifieds for a community (public)' })
  @ApiResponse({ status: 200, description: 'List of classified ads.' })
  async findByCommunity(
    @Param('communityId') communityId: string,
    @AppScope() appScope: string,
    @User() user: UserDetails | null
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.FIND_BY_COMMUNITY },
      {
        communityId,
        appScope: this.requireAppScope(appScope),
        requestingUserId: user?.userId,
      },
      'Failed to find classifieds'
    );
  }

  @Public()
  @Get('community-slug/:slug')
  @ApiOperation({
    summary: 'List all classifieds for a community by slug (public)',
  })
  @ApiResponse({ status: 200, description: 'List of classified ads.' })
  async findByCommunitySlug(
    @Param('slug') slug: string,
    @AppScope() appScope: string,
    @User() user: UserDetails | null
  ) {
    const communityId = await this.resolveCommunitySlugToId(slug);
    if (!communityId) {
      return [];
    }
    return this.forward(
      { cmd: ClassifiedCommands.FIND_BY_COMMUNITY },
      {
        communityId,
        appScope: this.requireAppScope(appScope),
        requestingUserId: user?.userId,
      },
      'Failed to find classifieds'
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a classified ad by ID (public)' })
  @ApiResponse({ status: 200, description: 'Classified ad found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findById(
    @Param('id') id: string,
    @AppScope() appScope: string,
    @User() user: UserDetails | null
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.FIND_BY_ID },
      {
        id,
        appScope: this.requireAppScope(appScope),
        requestingUserId: user?.userId,
      },
      'Failed to find classified'
    );
  }

  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Search classifieds (public)' })
  async search(
    @Body() dto: SearchClassifiedsDto,
    @AppScope() appScope: string,
    @User() user: UserDetails | null
  ) {
    let communityId = dto.communityId;
    if (!communityId && dto.communitySlug) {
      communityId = await this.resolveCommunitySlugToId(dto.communitySlug);
    }

    return this.forward(
      { cmd: ClassifiedCommands.SEARCH },
      {
        ...dto,
        communityId,
        appScope: this.requireAppScope(appScope),
        requestingUserId: user?.userId,
      },
      'Failed to search classifieds'
    );
  }

  // ─── Auth-gated write endpoints ───────────────────────────────────────────

  @Post()
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(CLASSIFIED_CREATE_THROTTLE)
  @RequirePermissions('classified.create')
  @ApiOperation({ summary: 'Create a classified ad (auth required)' })
  @ApiResponse({ status: 201, description: 'Classified ad created.' })
  async create(
    @User() user: UserDetails,
    @Body() dto: CreateClassifiedAdDto,
    @AppScope() appScope: string
  ) {
    this.logger.log(`Creating classified for profile=${user.profileId}`);

    let communityId = dto.communityId;
    if (!communityId && dto.communitySlug) {
      communityId = await this.resolveCommunitySlugToId(dto.communitySlug);
      this.logger.log(
        `Resolved communitySlug "${dto.communitySlug}" to communityId "${communityId}"`
      );
    }
    if (dto.communitySlug && !communityId) {
      throw new HttpException('Community not found', HttpStatus.NOT_FOUND);
    }
    const { communitySlug: _communitySlug, ...createDto } = dto;

    return this.forward(
      { cmd: ClassifiedCommands.CREATE },
      {
        dto: { ...createDto, communityId },
        profileId: user.profileId,
        userId: user.userId,
        appScope: this.requireAppScope(appScope),
      },
      'Failed to create classified'
    );
  }

  @Put(':id')
  @RequirePermissions('classified.update')
  @ApiOperation({ summary: 'Update a classified ad (auth required)' })
  async update(
    @User() user: UserDetails,
    @Param('id') id: string,
    @Body() dto: UpdateClassifiedAdDto,
    @AppScope() appScope: string
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.UPDATE },
      {
        id,
        dto,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      },
      'Failed to update classified'
    );
  }

  @Delete(':id')
  @RequirePermissions('classified.delete')
  @ApiOperation({ summary: 'Delete a classified ad (auth required)' })
  async remove(
    @User() user: UserDetails,
    @Param('id') id: string,
    @AppScope() appScope: string
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.DELETE },
      {
        id,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      },
      'Failed to remove classified'
    );
  }

  @Post(':id/sold')
  @RequirePermissions('classified.update')
  @ApiOperation({ summary: 'Mark a classified ad as sold' })
  async markSold(
    @User() user: UserDetails,
    @Param('id') id: string,
    @AppScope() appScope: string
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.MARK_SOLD },
      {
        id,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      },
      'Failed to mark classified sold'
    );
  }

  @Post(':id/feature')
  @RequirePermissions('classified.feature')
  @ApiOperation({
    summary: 'Feature a classified ad (requires payment / mod permission)',
  })
  async feature(
    @User() user: UserDetails,
    @Param('id') id: string,
    @Body() body: { durationDays: number },
    @AppScope() appScope: string
  ) {
    return this.forward(
      { cmd: ClassifiedCommands.FEATURE },
      {
        id,
        durationDays: body.durationDays,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      },
      'Failed to feature classified'
    );
  }

  @Get('profile/my-ads')
  @ApiOperation({ summary: "Get current user's classified ads" })
  async myAds(@User() user: UserDetails, @AppScope() appScope: string) {
    return this.forward(
      { cmd: ClassifiedCommands.FIND_BY_PROFILE },
      {
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
        requestingUserId: user.userId,
      },
      'Failed to find profile classifieds'
    );
  }
}
