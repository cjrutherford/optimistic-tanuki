import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SocialEventCommands as EventCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateEventDto,
  UpdateEventDto,
  EventDto,
  EventStatus,
} from '@optimistic-tanuki/models';

@UseGuards(AuthGuard)
@ApiTags('social-events')
@Controller('social-events')
export class SocialEventController {
  private readonly logger = new Logger(SocialEventController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully.',
    type: EventDto,
  })
  async createEvent(
    @Body() createEventDto: CreateEventDto,
    @User() user: UserDetails
  ): Promise<EventDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.CREATE },
        { ...createEventDto, userId: user.userId, profileId: user.profileId }
      )
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Event retrieved successfully.',
    type: EventDto,
  })
  async getEvent(@Param('id') id: string): Promise<EventDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: EventCommands.FIND }, { id })
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get events' })
  @ApiQuery({
    name: 'profileId',
    required: false,
    description: 'Filter by profile ID',
  })
  @ApiQuery({
    name: 'communityId',
    required: false,
    description: 'Filter by community ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EventStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'upcoming',
    required: false,
    description: 'Only upcoming events',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully.',
    type: [EventDto],
  })
  async getEvents(
    @Query('profileId') profileId?: string,
    @Query('communityId') communityId?: string,
    @Query('status') status?: EventStatus,
    @Query('upcoming') upcoming?: boolean
  ): Promise<EventDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.FIND_MANY },
        { profileId, communityId, status, upcoming }
      )
    );
  }

  @Get('upcoming/list')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events',
  })
  @ApiResponse({
    status: 200,
    description: 'Upcoming events retrieved successfully.',
    type: [EventDto],
  })
  async getUpcomingEvents(
    @Query('limit') limit: number = 10
  ): Promise<EventDto[]> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: EventCommands.FIND_UPCOMING }, { limit })
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Event updated successfully.',
    type: EventDto,
  })
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto
  ): Promise<EventDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.UPDATE },
        { id, data: updateEventDto }
      )
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Event deleted successfully.',
  })
  async deleteEvent(@Param('id') id: string): Promise<{ success: boolean }> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: EventCommands.DELETE }, { id })
    );
  }

  @Post(':id/attend')
  @ApiOperation({ summary: 'Attend an event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Now attending the event.',
    type: EventDto,
  })
  async attendEvent(
    @Param('id') eventId: string,
    @User() user: UserDetails
  ): Promise<EventDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.ATTEND },
        { eventId, profileId: user.profileId }
      )
    );
  }

  @Delete(':id/attend')
  @ApiOperation({ summary: 'Unattend an event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'No longer attending the event.',
    type: EventDto,
  })
  async unattendEvent(
    @Param('id') eventId: string,
    @User() user: UserDetails
  ): Promise<EventDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.UNATTEND },
        { eventId, profileId: user.profileId }
      )
    );
  }

  @Get(':id/attending')
  @ApiOperation({ summary: 'Check if user is attending an event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Attendance status retrieved.',
  })
  async isAttending(
    @Param('id') eventId: string,
    @User() user: UserDetails
  ): Promise<boolean> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: EventCommands.IS_ATTENDING },
        { eventId, profileId: user.profileId }
      )
    );
  }
}
