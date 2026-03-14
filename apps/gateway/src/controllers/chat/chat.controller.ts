import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Inject,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatClient: ClientProxy
  ) {}

  @Post('conversations/direct/get-or-create')
  @ApiOperation({ summary: 'Get or create a 1-to-1 direct conversation' })
  @ApiResponse({ status: 201, description: 'Conversation returned or created.' })
  async getOrCreateDirect(
    @User() _user: UserDetails,
    @Body() body: { participantIds: string[] }
  ) {
    this.logger.log(
      `getOrCreateDirect for participants: ${body.participantIds.join(', ')}`
    );
    return firstValueFrom(
      this.chatClient.send(
        { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
        { participantIds: body.participantIds }
      )
    );
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Array of messages.' })
  async getMessages(
    @User() _user: UserDetails,
    @Param('conversationId') conversationId: string
  ) {
    this.logger.log(`getMessages for conversation: ${conversationId}`);
    return firstValueFrom(
      this.chatClient.send(
        { cmd: ChatCommands.GET_MESSAGES },
        { conversationId }
      )
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent.' })
  async sendMessage(
    @User() user: UserDetails,
    @Body()
    body: {
      conversationId: string;
      content: string;
      recipientIds: string[];
    }
  ) {
    const senderId = user.profileId || user.userId;
    this.logger.log(
      `sendMessage from ${senderId} to conversation ${body.conversationId}`
    );
    return firstValueFrom(
      this.chatClient.send(
        { cmd: ChatCommands.SEND_MESSAGE },
        {
          conversationId: body.conversationId,
          content: body.content,
          senderId,
          recipientIds: body.recipientIds,
        }
      )
    );
  }
}
