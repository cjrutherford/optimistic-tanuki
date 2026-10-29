import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Inject,
  Logger,
  Optional,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import {
  ChatCommands,
  CommunityCommands,
  PrivacyCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { ProfileDto } from '@optimistic-tanuki/models';
import {
  ChatMessageDto,
  ConversationDto,
  CreateCommunityChatDto,
  GetOrCreateDirectChatBodyDto,
  SendMessageDto,
} from '@optimistic-tanuki/chat-contracts';
import {
  ChatGateway,
  PersistedChatMessageNotification,
} from '../../app/chat-gateway/chat.gateway';

@ApiBearerAuth()
@ApiTags('chat')
@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialService: ClientProxy,
    @Optional() private readonly chatGateway?: ChatGateway
  ) {}

  @Get('conversations/find')
  @ApiOperation({ summary: 'List conversations for the authenticated profile' })
  @ApiResponse({ status: 200, type: [ConversationDto] })
  async getConversations(@User() user: UserDetails) {
    return this.forward(
      { cmd: ChatCommands.GET_CONVERSATIONS },
      { profileId: user.profileId },
      'Failed to get conversations'
    );
  }

  @Get('conversations/id/:conversationId')
  @ApiOperation({ summary: 'Get one conversation by id' })
  @ApiResponse({ status: 200, type: ConversationDto })
  async getConversation(
    @Param('conversationId') conversationId: string,
    @User() user: UserDetails
  ) {
    return this.forward(
      { cmd: ChatCommands.GET_CONVERSATION },
      { conversationId, requestingProfileId: user.profileId },
      'Failed to get conversation'
    );
  }

  @Post('conversations/direct/get-or-create')
  @ApiOperation({ summary: 'Get or create a direct conversation' })
  @ApiResponse({ status: 201, type: ConversationDto })
  async getOrCreateDirectChat(
    @Body() body: GetOrCreateDirectChatBodyDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    const participantIds = await this.getAuthorizedDirectParticipants(
      body.recipientProfileId,
      user,
      appScope
    );
    await this.ensureDirectParticipantsCanInteract(participantIds);
    return this.forward(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      { participantIds },
      'Failed to get or create direct conversation'
    );
  }

  private async getAuthorizedDirectParticipants(
    recipientProfileId: string,
    user: UserDetails,
    appScope: string
  ): Promise<string[]> {
    if (
      !user.profileId ||
      !recipientProfileId ||
      recipientProfileId === user.profileId
    ) {
      throw new ForbiddenException('A different recipient profile is required');
    }

    const recipient = await firstValueFrom(
      this.profileService.send<ProfileDto>(
        { cmd: ProfileCommands.Get },
        {
          id: recipientProfileId,
        }
      )
    );
    const effectiveScope = appScope === 'owner-console' ? 'global' : appScope;
    if (
      !recipient ||
      recipient.userId === user.userId ||
      ![effectiveScope, 'global', null].includes(recipient.appScope ?? null)
    ) {
      throw new ForbiddenException('Recipient is not available in this app');
    }

    return [user.profileId, recipientProfileId];
  }

  private async ensureDirectParticipantsCanInteract(
    participantIds: string[]
  ): Promise<void> {
    const [first, second] = [...new Set(participantIds)].sort();
    if (!first || !second) return;
    const [firstBlockedSecond, secondBlockedFirst] = await Promise.all([
      firstValueFrom(
        this.socialService.send(
          { cmd: PrivacyCommands.IS_USER_BLOCKED },
          { blockerId: first, blockedId: second }
        )
      ),
      firstValueFrom(
        this.socialService.send(
          { cmd: PrivacyCommands.IS_USER_BLOCKED },
          { blockerId: second, blockedId: first }
        )
      ),
    ]);
    if (firstBlockedSecond || secondBlockedFirst) {
      throw new ForbiddenException('Direct messaging is unavailable');
    }
  }

  @Post('conversations/community')
  @ApiOperation({ summary: 'Create a community conversation' })
  @ApiResponse({ status: 201, type: ConversationDto })
  async createCommunityChat(
    @Body() body: CreateCommunityChatDto,
    @User() user: UserDetails
  ) {
    const members = await firstValueFrom(
      this.socialService.send(
        { cmd: CommunityCommands.GET_MEMBERS },
        { communityId: body.communityId }
      )
    );
    const actor = members?.find(
      (m) => m.profileId === user.profileId && m.status === 'approved'
    );
    if (!actor || !['owner', 'admin', 'moderator'].includes(actor.role))
      throw new ForbiddenException('Community management access is required');
    body.ownerId = user.profileId;
    return this.forward(
      { cmd: ChatCommands.CREATE_COMMUNITY_CHAT },
      body,
      'Failed to create community conversation'
    );
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiResponse({ status: 200, type: [ChatMessageDto] })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @User() user: UserDetails
  ) {
    // The reader's own profile, from the session. Without it this route
    // answered any conversation id with everything in it.
    return this.forward(
      { cmd: ChatCommands.GET_MESSAGES },
      { conversationId, requestingProfileId: user.profileId },
      'Failed to get messages'
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message (sender from session)' })
  @ApiResponse({ status: 201, type: ChatMessageDto })
  async sendMessage(
    @Body()
    body: SendMessageDto,
    @User() user: UserDetails
  ) {
    const conversation = await this.forward<
      any,
      { type?: string; participants?: string[] }
    >(
      { cmd: ChatCommands.GET_CONVERSATION },
      {
        conversationId: body.conversationId,
        requestingProfileId: user.profileId,
      },
      'Failed to get conversation'
    );
    if (conversation?.type === 'direct') {
      await this.ensureDirectParticipantsCanInteract(
        conversation.participants ?? []
      );
    }
    const stored = await this.forward<any, PersistedChatMessageNotification>(
      { cmd: ChatCommands.SEND_MESSAGE },
      { ...body, senderId: user.profileId },
      'Failed to send message'
    );
    // Persistence has succeeded. Live delivery must not turn it into a failed
    // HTTP send (and an accidental duplicate retry); authorized history recovers it.
    if (this.chatGateway) {
      void this.chatGateway
        .notifyPersistedMessage(body.conversationId, stored)
        .catch(() =>
          this.logger.warn('Live chat delivery unavailable; message persisted')
        );
    }
    return stored;
  }

  private async forward<TPayload, TResult>(
    pattern: { cmd: string },
    payload: TPayload,
    fallbackMessage: string
  ): Promise<TResult> {
    try {
      return await firstValueFrom(this.chatService.send(pattern, payload));
    } catch (error) {
      throw this.toHttpException(error, fallbackMessage);
    }
  }

  private toHttpException(
    error: unknown,
    fallbackMessage: string
  ): HttpException {
    const source = error as {
      message?: string;
      error?: { message?: string; statusCode?: number; errors?: string[] };
      statusCode?: number;
      errors?: string[];
    };
    const nested = source?.error;
    const statusCode = nested?.statusCode ?? source?.statusCode ?? 500;
    const message = nested?.message ?? source?.message ?? fallbackMessage;
    const errors = nested?.errors ?? source?.errors;

    return new HttpException(
      errors ? { message, errors } : { message },
      statusCode
    );
  }
}
