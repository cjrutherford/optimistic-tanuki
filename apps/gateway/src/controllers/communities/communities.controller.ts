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
import { LocalCommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

@ApiTags('communities')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('communities')
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsClient: ClientProxy
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all local communities' })
  @ApiResponse({ status: 200, description: 'Array of local communities.' })
  listCommunities() {
    return firstValueFrom(
      this.classifiedsClient.send({ cmd: LocalCommunityCommands.LIST }, {})
    );
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a local community by slug' })
  @ApiResponse({ status: 200, description: 'Local community.' })
  findCommunity(@Param('slug') slug: string) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: LocalCommunityCommands.FIND_BY_SLUG },
        { slug }
      )
    );
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a local community' })
  @ApiResponse({ status: 201, description: 'Successfully joined.' })
  joinCommunity(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: LocalCommunityCommands.JOIN },
        { communityId: id, userId: user.userId, profileId: user.profileId }
      )
    );
  }

  @Delete(':id/membership')
  @ApiOperation({ summary: 'Leave a local community' })
  @ApiResponse({ status: 200, description: 'Successfully left.' })
  leaveCommunity(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: LocalCommunityCommands.LEAVE },
        { communityId: id, userId: user.userId }
      )
    );
  }

  @Get(':id/membership')
  @ApiOperation({ summary: 'Check if authenticated user is a member' })
  @ApiResponse({ status: 200, description: 'Boolean membership status.' })
  checkMembership(@Param('id') id: string, @User() user: UserDetails) {
    return firstValueFrom(
      this.classifiedsClient.send(
        { cmd: LocalCommunityCommands.IS_MEMBER },
        { communityId: id, userId: user.userId }
      )
    );
  }
}
