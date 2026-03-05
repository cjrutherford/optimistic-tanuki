import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PresenceCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

export interface SetPresenceDto {
  userId: string;
  status: PresenceStatus;
}

export interface PresenceDto {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  isExplicit: boolean;
}

@UseGuards(AuthGuard)
@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  private readonly logger = new Logger(PresenceController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Post()
  @ApiOperation({ summary: 'Set user presence status' })
  @ApiResponse({
    status: 201,
    description: 'The presence has been successfully set.',
  })
  async setPresence(
    @Body() setPresenceDto: SetPresenceDto
  ): Promise<PresenceDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.SET_PRESENCE },
        setPresenceDto
      )
    );
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get presence status for a user' })
  @ApiResponse({
    status: 200,
    description: 'The presence has been successfully retrieved.',
  })
  async getPresence(
    @Param('userId') userId: string
  ): Promise<PresenceDto | null> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PresenceCommands.GET_PRESENCE }, { userId })
    );
  }

  @Post('batch')
  @ApiOperation({ summary: 'Get presence status for multiple users' })
  @ApiResponse({
    status: 200,
    description: 'The presences have been successfully retrieved.',
  })
  async getPresenceBatch(
    @Body() body: { userIds: string[] }
  ): Promise<PresenceDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.GET_PRESENCE_BATCH },
        { userIds: body.userIds }
      )
    );
  }

  @Get('online/users')
  @ApiOperation({ summary: 'Get all online users' })
  @ApiResponse({
    status: 200,
    description: 'The online users have been successfully retrieved.',
  })
  async getOnlineUsers(): Promise<PresenceDto[]> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PresenceCommands.GET_ONLINE_USERS }, {})
    );
  }

  @Put(':userId/last-seen')
  @ApiOperation({ summary: 'Update user last seen timestamp' })
  @ApiResponse({
    status: 200,
    description: 'The last seen has been successfully updated.',
  })
  async updateLastSeen(@Param('userId') userId: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.UPDATE_LAST_SEEN },
        { userId }
      )
    );
  }

  @Put(':userId/offline')
  @ApiOperation({ summary: 'Set user as offline' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully set as offline.',
  })
  async setOffline(@Param('userId') userId: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PresenceCommands.SET_OFFLINE }, { userId })
    );
  }
}
