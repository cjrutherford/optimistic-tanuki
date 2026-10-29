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
  ForbiddenException,
  BadRequestException,
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
import { SocialGateway } from '../../../app/social-gateway/social.gateway';
import { GatewayNotificationRecipientService } from './gateway-notification-recipient.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    private readonly socialClient: ClientProxy,
    private readonly socialGateway: SocialGateway,
    private readonly recipients: GatewayNotificationRecipientService
  ) {}

  @Get(':profileId')
  @ApiOperation({ summary: 'Get all notifications for a profile' })
  @ApiResponse({
    status: 200,
    description: 'The notifications have been successfully retrieved.',
  })
  async getNotifications(
    @Param('profileId') profileId: string,
    @User() user: UserDetails
  ): Promise<NotificationDto[]> {
    const recipientId = await this.recipients.assertSelected(user, profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.FIND_BY_RECIPIENT },
        { recipientId }
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
    @Param('profileId') profileId: string,
    @User() user: UserDetails
  ): Promise<{ count: number }> {
    const recipientId = await this.recipients.assertSelected(user, profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.GET_UNREAD_COUNT },
        { recipientId }
      )
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Notification creation is not available to public clients',
  })
  @ApiResponse({
    status: 403,
    description: 'Notification creation is forbidden.',
  })
  async create(
    @Body() _createNotificationDto: CreateNotificationDto
  ): Promise<never> {
    throw new ForbiddenException(
      'Notification creation is not available to public clients.'
    );
  }

  @Put(':notificationId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully marked as read.',
  })
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @User() user: UserDetails
  ): Promise<void> {
    const recipientId = await this.recipients.assertSelected(user);
    this.assertNotificationId(notificationId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.MARK_READ },
        { id: notificationId, recipientId }
      )
    );
  }

  @Put(':profileId/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a profile' })
  @ApiResponse({
    status: 200,
    description: 'All notifications have been successfully marked as read.',
  })
  async markAllAsRead(
    @Param('profileId') profileId: string,
    @User() user: UserDetails
  ): Promise<void> {
    if (!UUID_PATTERN.test(profileId)) {
      throw new BadRequestException('Profile id must be a UUID.');
    }
    const recipientId = await this.recipients.assertSelected(user, profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.MARK_ALL_READ },
        { recipientId }
      )
    );
  }

  @Delete(':notificationId')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'The notification has been successfully deleted.',
  })
  async delete(
    @Param('notificationId') notificationId: string,
    @User() user: UserDetails
  ): Promise<void> {
    const recipientId = await this.recipients.assertSelected(user);
    this.assertNotificationId(notificationId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: NotificationCommands.DELETE },
        { id: notificationId, recipientId }
      )
    );
  }

  private assertNotificationId(notificationId: string): void {
    if (!UUID_PATTERN.test(notificationId)) {
      throw new BadRequestException('Notification id must be a UUID.');
    }
  }
}
