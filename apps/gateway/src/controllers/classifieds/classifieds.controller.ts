import {
  Body,
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
    @AppScope() appScope: string
  ) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.FIND_BY_COMMUNITY },
        { communityId, appScope }
      )
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
    @AppScope() appScope: string
  ) {
    const communityId = await this.resolveCommunitySlugToId(slug);
    if (!communityId) {
      return [];
    }
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.FIND_BY_COMMUNITY },
        { communityId, appScope }
      )
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a classified ad by ID (public)' })
  @ApiResponse({ status: 200, description: 'Classified ad found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findById(@Param('id') id: string, @AppScope() appScope: string) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.FIND_BY_ID },
        { id, appScope }
      )
    );
  }

  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Search classifieds (public)' })
  async search(
    @Body() dto: SearchClassifiedsDto,
    @AppScope() appScope: string
  ) {
    let communityId = dto.communityId;
    if (!communityId && dto.communitySlug) {
      communityId = await this.resolveCommunitySlugToId(dto.communitySlug);
    }

    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.SEARCH },
        { ...dto, communityId, appScope }
      )
    );
  }

  // ─── Auth-gated write endpoints ───────────────────────────────────────────

  @Post()
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

    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.CREATE },
        {
          dto: { ...dto, communityId },
          profileId: user.profileId,
          userId: user.userId,
          appScope,
        }
      )
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
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.UPDATE },
        { id, dto, profileId: user.profileId, appScope }
      )
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
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.DELETE },
        { id, profileId: user.profileId, appScope }
      )
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
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.MARK_SOLD },
        { id, profileId: user.profileId, appScope }
      )
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
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.FEATURE },
        {
          id,
          durationDays: body.durationDays,
          profileId: user.profileId,
          appScope,
        }
      )
    );
  }

  @Get('profile/my-ads')
  @ApiOperation({ summary: "Get current user's classified ads" })
  async myAds(@User() user: UserDetails, @AppScope() appScope: string) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: ClassifiedCommands.FIND_BY_PROFILE },
        { profileId: user.profileId, appScope }
      )
    );
  }
}
