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
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PresenceCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GatewayPresenceAudienceService } from './gateway-presence-audience.service';

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    private readonly socialClient: ClientProxy,
    private readonly audienceService: GatewayPresenceAudienceService
  ) {}

  private canonicalAccountPath(
    requestedUserId: unknown,
    user: UserDetails | null | undefined
  ): string {
    const accountId = this.accountActor(user);
    if (
      typeof requestedUserId !== 'string' ||
      !UUID_PATTERN.test(requestedUserId)
    ) {
      throw new BadRequestException('A valid account ID is required.');
    }
    if (requestedUserId.toLowerCase() !== accountId) {
      throw new ForbiddenException(
        'Presence reads are limited to the authenticated account'
      );
    }
    return accountId;
  }

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
    @Param('userId') userId: string,
    @User() user: UserDetails | null
  ): Promise<PresenceDto | null> {
    const accountId = this.canonicalAccountPath(userId, user);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.GET_PRESENCE },
        { userId: accountId }
      )
    );
  }

  @Post('batch')
  @ApiOperation({ summary: 'Get presence status for multiple users' })
  @ApiResponse({
    status: 200,
    description: 'The presences have been successfully retrieved.',
  })
  async getPresenceBatch(
    @Body() body: { userIds: string[] },
    @User() user: UserDetails | null
  ): Promise<PresenceDto[]> {
    const accountId = this.accountActor(user);
    if (!body || !Array.isArray(body.userIds) || body.userIds.length > 100) {
      throw new BadRequestException(
        'At most 100 valid account IDs are allowed.'
      );
    }
    const userIds = body.userIds.map((id) => {
      if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        throw new BadRequestException('A valid account ID is required.');
      }
      return id.toLowerCase();
    });
    if (userIds.some((id) => id !== accountId)) {
      throw new ForbiddenException(
        'Presence reads are limited to the authenticated account'
      );
    }
    if (userIds.length === 0) return [];
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.GET_PRESENCE_BATCH },
        { userIds: [accountId] }
      )
    );
  }

  @Get('online/users')
  @ApiOperation({ summary: 'Get all online users' })
  @ApiResponse({
    status: 200,
    description: 'The online users have been successfully retrieved.',
  })
  async getOnlineUsers(
    @User() user: UserDetails | null
  ): Promise<PresenceDto[]> {
    const accountId = this.accountActor(user);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PresenceCommands.GET_ONLINE_USERS },
        { userIds: [accountId] }
      )
    );
  }

  @Post('conversation')
  @ApiOperation({ summary: 'Get presence for participants in a conversation' })
  async getConversationPresence(
    @Body() body: { conversationId: string; profileIds: string[] },
    @User() user: UserDetails | null
  ): Promise<{ profileId: string; status: string }[]> {
    const accountId = this.accountActor(user);
    const selectedProfileId = user?.profileId;
    if (!canonicalUUID(selectedProfileId)) {
      throw new UnauthorizedException(
        'Authenticated profile identity is invalid'
      );
    }
    if (
      !body ||
      !canonicalUUID(body.conversationId) ||
      !Array.isArray(body.profileIds) ||
      body.profileIds.length > 100 ||
      !body.profileIds.every(canonicalUUID)
    ) {
      throw new BadRequestException(
        'A valid conversation and at most 100 profile IDs are required.'
      );
    }
    const profileIds = [
      ...new Set(body.profileIds.map((id) => id.toLowerCase())),
    ];
    return this.audienceService.resolveConversationPresence(
      accountId,
      selectedProfileId.toLowerCase(),
      body.conversationId.toLowerCase(),
      profileIds
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

function canonicalUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
