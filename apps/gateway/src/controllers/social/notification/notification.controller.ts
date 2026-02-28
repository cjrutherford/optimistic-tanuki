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
import {
  NotificationCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

export interface CreateNotificationDto {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  senderId?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
}

export interface NotificationDto {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  senderId?: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: Date;
}

@UseGuards(AuthGuard)
@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Get(':profileId')
  @ApiOperation({ summary: 'Get all notifications for a profile' })
  @ApiResponse({
    status: 200,
    description: 'The notifications have been successfully retrieved.',
  })
  async getNotifications(
    @Param('profileId') profileId: string
  ): Promise<NotificationDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.FIND_BY_RECIPIENT },
        { recipientId: profileId }
      )
    );
  }

  @Get(':profileId/unread-count')
  @ApiOperation({ summary: 'Get unread notification count for a profile' })
  @ApiResponse({
    status: 200,
    description: 'The unread count has been successfully retrieved.',
  })
  async getUnreadCount(
    @Param('profileId') profileId: string
  ): Promise<{ count: number }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.GET_UNREAD_COUNT },
        { recipientId: profileId }
      )
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({
    status: 201,
    description: 'The notification has been successfully created.',
  })
  async create(
    @Body() createNotificationDto: CreateNotificationDto
  ): Promise<NotificationDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.CREATE },
        createNotificationDto
      )
    );
  }

  @Put(':notificationId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully marked as read.',
  })
  async markAsRead(
    @Param('notificationId') notificationId: string
  ): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.MARK_READ },
        { id: notificationId }
      )
    );
  }

  @Put(':profileId/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a profile' })
  @ApiResponse({
    status: 200,
    description: 'All notifications have been successfully marked as read.',
  })
  async markAllAsRead(@Param('profileId') profileId: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.MARK_ALL_READ },
        { recipientId: profileId }
      )
    );
  }

  @Delete(':notificationId')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully deleted.',
  })
  async delete(@Param('notificationId') notificationId: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.DELETE },
        { id: notificationId }
      )
    );
  }
}
