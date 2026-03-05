import {
  Controller,
  Get,
  Post,
  Put,
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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PollCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreatePollDto,
  UpdatePollDto,
  VotePollDto,
  PollDto,
  PollWithResultsDto,
} from '@optimistic-tanuki/models';

@UseGuards(AuthGuard)
@ApiTags('polls')
@Controller('polls')
export class PollController {
  private readonly logger = new Logger(PollController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new poll' })
  @ApiResponse({
    status: 201,
    description: 'Poll created successfully.',
    type: PollDto,
  })
  async createPoll(
    @Body() createPollDto: CreatePollDto,
    @User() user: UserDetails
  ): Promise<PollDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PollCommands.CREATE },
        { ...createPollDto, userId: user.userId, profileId: user.profileId }
      )
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a poll by ID' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Poll retrieved successfully.',
    type: PollDto,
  })
  async getPoll(@Param('id') id: string): Promise<PollDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PollCommands.FIND }, { id })
    );
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get poll with results' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Poll results retrieved successfully.',
    type: PollWithResultsDto,
  })
  async getPollResults(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<PollWithResultsDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PollCommands.FIND },
        { id, userId: user.userId }
      )
    );
  }

  @Get('profile/:profileId')
  @ApiOperation({ summary: 'Get polls by profile ID' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Polls retrieved successfully.',
    type: [PollDto],
  })
  async getPollsByProfile(
    @Param('profileId') profileId: string
  ): Promise<PollDto[]> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PollCommands.FIND_MANY }, { profileId })
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a poll' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Poll updated successfully.',
    type: PollDto,
  })
  async updatePoll(
    @Param('id') id: string,
    @Body() updatePollDto: UpdatePollDto
  ): Promise<PollDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PollCommands.UPDATE },
        { id, data: updatePollDto }
      )
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a poll' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Poll deleted successfully.',
  })
  async deletePoll(@Param('id') id: string): Promise<{ success: boolean }> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PollCommands.DELETE }, { id })
    );
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote on a poll' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully.',
    type: PollDto,
  })
  async votePoll(
    @Param('id') pollId: string,
    @Body() voteData: { optionIndices: number[] },
    @User() user: UserDetails
  ): Promise<PollDto> {
    const voteDto: VotePollDto = {
      pollId,
      userId: user.userId,
      optionIndices: voteData.optionIndices,
    };
    return await firstValueFrom(
      this.socialClient.send({ cmd: PollCommands.VOTE }, voteDto)
    );
  }

  @Delete(':id/vote')
  @ApiOperation({ summary: 'Remove vote from a poll' })
  @ApiParam({ name: 'id', description: 'Poll ID' })
  @ApiResponse({
    status: 200,
    description: 'Vote removed successfully.',
    type: PollDto,
  })
  async removeVote(
    @Param('id') pollId: string,
    @User() user: UserDetails
  ): Promise<PollDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PollCommands.REMOVE_VOTE },
        { pollId, userId: user.userId }
      )
    );
  }
}
