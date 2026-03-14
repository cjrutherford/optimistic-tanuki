import {
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
import { CommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';

@ApiTags('communities')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('communities')
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all locality-based communities' })
  @ApiResponse({ status: 200, description: 'Array of locality communities.' })
  listCommunities(@AppScope() appScope: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.LIST_LOCALITY },
        { appScope }
      )
    );
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a locality community by slug' })
  @ApiResponse({ status: 200, description: 'Community.' })
  findCommunity(@Param('slug') slug: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.FIND_BY_SLUG },
        { slug }
      )
    );
  }

  @Public()
  @Get(':id/sub-communities')
  @ApiOperation({ summary: 'Get sub-communities of a locality community' })
  @ApiResponse({ status: 200, description: 'Array of sub-communities.' })
  getSubCommunities(@Param('id') id: string) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_SUB_COMMUNITIES },
        { parentId: id }
      )
    );
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  @ApiResponse({ status: 201, description: 'Successfully joined.' })
  joinCommunity(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
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

  @Delete(':id/membership')
  @ApiOperation({ summary: 'Leave a community' })
  @ApiResponse({ status: 200, description: 'Successfully left.' })
  leaveCommunity(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.LEAVE },
        { communityId: id, userId: user.userId }
      )
    );
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
}
