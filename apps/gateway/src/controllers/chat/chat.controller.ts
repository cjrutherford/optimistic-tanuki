import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';

@ApiBearerAuth()
@ApiTags('chat')
@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatService: ClientProxy
  ) {}

  @Get('conversations/find')
  async getConversations(@Query('profileId') profileId: string) {
    return this.forward(
      { cmd: ChatCommands.GET_CONVERSATIONS },
      { profileId },
      'Failed to get conversations'
    );
  }

  @Get('conversations/id/:conversationId')
  async getConversation(@Param('conversationId') conversationId: string) {
    return this.forward(
      { cmd: ChatCommands.GET_CONVERSATION },
      { conversationId },
      'Failed to get conversation'
    );
  }

  @Post('conversations/direct')
  async createDirectChat(@Body() body: { participantIds: string[] }) {
    return this.forward(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      { participantIds: body.participantIds },
      'Failed to create direct conversation'
    );
  }

  @Post('conversations/direct/get-or-create')
  async getOrCreateDirectChat(@Body() body: { participantIds: string[] }) {
    return this.forward(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      { participantIds: body.participantIds },
      'Failed to get or create direct conversation'
    );
  }

  @Post('conversations/community')
  async createCommunityChat(
    @Body() body: { communityId: string; ownerId: string; name?: string }
  ) {
    return this.forward(
      { cmd: ChatCommands.CREATE_COMMUNITY_CHAT },
      body,
      'Failed to create community conversation'
    );
  }

  @Get('messages/:conversationId')
  async getMessages(@Param('conversationId') conversationId: string) {
    return this.forward(
      { cmd: ChatCommands.GET_MESSAGES },
      { conversationId },
      'Failed to get messages'
    );
  }

  @Post('messages')
  async sendMessage(
    @Body()
    body: {
      conversationId: string;
      content: string;
      senderId: string;
      recipientIds: string[];
    }
  ) {
    return this.forward(
      { cmd: ChatCommands.SEND_MESSAGE },
      body,
      'Failed to send message'
    );
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
