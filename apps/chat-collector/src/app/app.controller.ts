import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatCommands, CommonCommands } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';

@Controller()
export class AppController {
  constructor(
    private readonly l: Logger,
    private readonly appService: AppService
  ) {}

  @MessagePattern({ cmd: CommonCommands.HealthCheck })
  healthCheck() {
    return { status: 'healthy' };
  }

  @MessagePattern({ cmd: ChatCommands.POST_MESSAGE })
  async postMessage(@Payload() data: ChatMessage) {
    return await this.appService.postMessage(data);
  }

  @MessagePattern({ cmd: ChatCommands.GET_CONVERSATIONS })
  async getConversations(@Payload() data: { profileId: string }) {
    this.l.log(`Retrieving conversations for profile ID: ${data.profileId}`);
    return await this.appService.getConversations(data.profileId);
  }

  @MessagePattern({ cmd: ChatCommands.GET_CONVERSATION })
  async getConversation(@Payload() data: { conversationId: string }) {
    this.l.log(`Retrieving conversation for ID: ${data.conversationId}`);
    return await this.appService.getConversation(data.conversationId);
  }

  @MessagePattern({ cmd: 'CREATE_COMMUNITY_CHAT' })
  async createCommunityChat(
    @Payload() data: { communityId: string; ownerId: string; name?: string }
  ) {
    this.l.log(`Creating community chat for community: ${data.communityId}`);
    return await this.appService.createCommunityChat(
      data.communityId,
      data.ownerId,
      data.name
    );
  }

  // REST Endpoints
  @Get('health')
  healthCheckHttp() {
    return { status: 'healthy' };
  }

  @Get('conversations/:profileId')
  async getConversationsHttp(@Param('profileId') profileId: string) {
    this.l.log(`HTTP: Retrieving conversations for profile ID: ${profileId}`);
    return await this.appService.getConversationsHttp(profileId);
  }

  @Get('conversations/id/:conversationId')
  async getConversationHttp(@Param('conversationId') conversationId: string) {
    this.l.log(`HTTP: Retrieving conversation for ID: ${conversationId}`);
    return await this.appService.getConversationHttp(conversationId);
  }

  @Post('conversations/direct')
  async createDirectChatHttp(@Body() data: { participantIds: string[] }) {
    this.l.log(
      `HTTP: Creating direct chat for participants: ${data.participantIds.join(
        ', '
      )}`
    );
    return await this.appService.createDirectChat(data.participantIds);
  }

  @Post('conversations/direct/get-or-create')
  async getOrCreateDirectChatHttp(@Body() data: { participantIds: string[] }) {
    this.l.log(
      `HTTP: Getting or creating direct chat for participants: ${data.participantIds.join(
        ', '
      )}`
    );
    return await this.appService.getOrCreateDirectChat(data.participantIds);
  }

  @Post('conversations/community')
  async createCommunityChatHttp(
    @Body() data: { communityId: string; ownerId: string; name?: string }
  ) {
    this.l.log(
      `HTTP: Creating community chat for community: ${data.communityId}`
    );
    return await this.appService.createCommunityChat(
      data.communityId,
      data.ownerId,
      data.name
    );
  }

  @Delete('conversations/:conversationId')
  async deleteConversationHttp(
    @Param('conversationId') conversationId: string,
    @Body() data: { userId: string }
  ) {
    this.l.log(`HTTP: Deleting conversation: ${conversationId}`);
    return await this.appService.deleteConversation(
      conversationId,
      data.userId
    );
  }

  @Get('messages/:conversationId')
  async getMessagesHttp(@Param('conversationId') conversationId: string) {
    this.l.log(`HTTP: Retrieving messages for conversation: ${conversationId}`);
    return await this.appService.getMessages(conversationId);
  }

  @Post('messages')
  async sendMessageHttp(
    @Body()
    data: {
      conversationId: string;
      content: string;
      senderId: string;
      recipientIds: string[];
    }
  ) {
    this.l.log(`HTTP: Sending message to conversation: ${data.conversationId}`);
    return await this.appService.postMessageHttp(data);
  }
}
