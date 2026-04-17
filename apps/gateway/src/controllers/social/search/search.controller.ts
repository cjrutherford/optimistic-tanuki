import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchCommands, ServiceTokens } from '@optimistic-tanuki/constants';

export interface SearchResult {
  type: 'user' | 'post' | 'community';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  highlight?: string;
}

export interface SearchResponse {
  users: SearchResult[];
  posts: SearchResult[];
  communities: SearchResult[];
  total: number;
}

export interface SearchHistoryDto {
  id: string;
  profileId: string;
  query: string;
  searchType: string;
  resultCount: number;
  createdAt: Date;
}

@UseGuards(AuthGuard)
@ApiTags('search')
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search for users, posts, and communities' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'users', 'posts', 'communities'],
    description: 'Search type filter',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum results per category',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully.',
  })
  async search(
    @Query('q') query: string,
    @Query('type') type: 'all' | 'users' | 'posts' | 'communities' = 'all',
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
    @User() user: UserDetails
  ): Promise<SearchResponse> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SearchCommands.SEARCH },
        {
          query,
          options: { type, limit, offset },
          profileId: user.profileId,
        }
      )
    );
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending posts' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of trending posts',
  })
  @ApiResponse({
    status: 200,
    description: 'Trending posts retrieved successfully.',
  })
  async getTrending(
    @Query('limit') limit: number = 10
  ): Promise<SearchResult[]> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: SearchCommands.GET_TRENDING }, { limit })
    );
  }

  @Get('suggested-users')
  @ApiOperation({ summary: 'Get suggested users to follow' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of suggested users',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggested users retrieved successfully.',
  })
  async getSuggestedUsers(
    @Query('limit') limit: number = 10,
    @User() user: UserDetails
  ): Promise<SearchResult[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SearchCommands.GET_SUGGESTED_USERS },
        { limit, profileId: user.profileId }
      )
    );
  }

  @Get('suggested-communities')
  @ApiOperation({ summary: 'Get suggested communities to join' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of suggested communities',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggested communities retrieved successfully.',
  })
  async getSuggestedCommunities(
    @Query('limit') limit: number = 10
  ): Promise<SearchResult[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SearchCommands.GET_SUGGESTED_COMMUNITIES },
        { limit }
      )
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user search history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of history items',
  })
  @ApiResponse({
    status: 200,
    description: 'Search history retrieved successfully.',
  })
  async getSearchHistory(
    @Query('limit') limit: number = 10,
    @User() user: UserDetails
  ): Promise<SearchHistoryDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SearchCommands.GET_SEARCH_HISTORY },
        { profileId: user.profileId, limit }
      )
    );
  }
}
