import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';

@Controller()
export class AppController {
  constructor(private readonly l: Logger, private readonly appService: AppService) {}

  @MessagePattern({ cmd: ChatCommands.POST_MESSAGE})
  async postMessage(@Payload() data: ChatMessage) {
    return await this.appService.postMessage(data);
  }

  @MessagePattern({ cmd: ChatCommands.GET_CONVERSATIONS })
  async getConversations(@Payload() data: { profileId: string }) {
    this.l.log(`Retrieving conversations for profile ID: ${data.profileId}`);
    return await this.appService.getConversations(data.profileId);
  }
}
