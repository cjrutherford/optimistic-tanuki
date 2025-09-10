import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { AIOrchestrationCommands } from '@optimistic-tanuki/constants';
import { ChatConversation, ChatMessage, PersonaTelosDto } from '@optimistic-tanuki/models';

@Controller()
export class AppController {
  constructor(private readonly l: Logger, private readonly appService: AppService) {}

  @MessagePattern({ cmd: AIOrchestrationCommands.PROFILE_INITIALIZE })
  async profileInitialize(data: { profileId: string }) {
    this.l.log('profile initialized called. here\'s where we create the welcome chat....')
    await this.appService.processNewProfile(data.profileId);
    return data;
  }


  @MessagePattern({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE })
  async conversationUpdate(data: {conversation: ChatConversation, aiPersonas: PersonaTelosDto[]}) {
    this.l.log('conversation updated called. here\'s where we update the chats and prompt the AI again....')
    if (!data.conversation.id) {
      throw new RpcException('Conversation ID is required');
    }
    const update: Partial<ChatMessage>[] = await this.appService.updateConversation(data);
    return update;
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.TELOS_UPDATE })
  async telosUpdate(data: any) {
    this.l.log('telos updated called. here\'s where we update the telos documents....')
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.REFER_PERSONA })
  async referPersona(data: any) {
    this.l.log('refer persona called. here\'s where we refer the persona....')
  }
}