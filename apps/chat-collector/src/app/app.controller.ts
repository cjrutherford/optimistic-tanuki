import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';

@Controller()
/**
 * Controller for handling chat-related operations.
 */
@Controller()
export class AppController {
  /**
   * Creates an instance of AppController.
   * @param appService The application service.
   */
  constructor(private readonly appService: AppService) {}

  /**
   * Handles posting a new chat message.
   * @param data The chat message data.
   * @returns The result of posting the message.
   */
  @MessagePattern({ cmd: ChatCommands.POST_MESSAGE})
  async postMessage(@Payload() data: ChatMessage) {
    return await this.appService.postMessage(data);
  }

  /**
   * Handles retrieving chat conversations for a given profile.
   * @param data The payload containing the profile ID.
   * @returns The chat conversations.
   */
  @MessagePattern({ cmd: ChatCommands.GET_CONVERSATIONS })
  async getConversations(@Payload() data: { profileId: string }) {
    return await this.appService.getConversations(data.profileId);
  }
}
