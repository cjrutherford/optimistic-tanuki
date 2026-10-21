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
  ForbiddenException,
  UnauthorizedException,
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
  private accountActor(user: UserDetails | null | undefined): string {
    const userId = user?.userId;
    if (
      typeof userId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      )
    ) {
      throw new UnauthorizedException(
        'Authenticated account identity is invalid'
      );
    }
    return userId.toLowerCase();
  }

  private assertOwnAccountPath(
    userId: string,
    user: UserDetails | null | undefined
  ): string {
    const accountId = this.accountActor(user);
    if (typeof userId !== 'string' || userId.toLowerCase() !== accountId) {
      throw new ForbiddenException(
        'Presence mutations are limited to the authenticated account'
      );
    }
    return accountId;
  }

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
    @Body() setPresenceDto: SetPresenceDto,
    @User() user: UserDetails | null
  ): Promise<PresenceDto> {
    const userId = this.accountActor(user);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.SET_PRESENCE },
        { ...setPresenceDto, userId }
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
  async updateLastSeen(
    @Param('userId') userId: string,
    @User() user: UserDetails | null
  ): Promise<void> {
    const accountId = this.assertOwnAccountPath(userId, user);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.UPDATE_LAST_SEEN },
        { userId: accountId }
      )
    );
  }

  @Put(':userId/offline')
  @ApiOperation({ summary: 'Set user as offline' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully set as offline.',
  })
  async setOffline(
    @Param('userId') userId: string,
    @User() user: UserDetails | null
  ): Promise<void> {
    const accountId = this.assertOwnAccountPath(userId, user);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.SET_OFFLINE },
        { userId: accountId }
      )
    );
  }
}
