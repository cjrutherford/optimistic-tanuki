import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern } from '@nestjs/microservices';
import { AIOrchestrationCommands } from '@optimistic-tanuki/constants';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: AIOrchestrationCommands.PROFILE_INITIALIZE })
  async profileInitialize(data: { profileId: string }) {
    console.log('profile initialized called. here\'s where we create the welcome chat....')
    await this.appService.processNewProfile(data.profileId);
    return data;
  }


  @MessagePattern({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE })
  async conversationUpdate(data: any) {
    console.log('conversation updated called. here\'s where we update the chats and prompt the AI again....')
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.TELOS_UPDATE })
  async telosUpdate(data: any) {
    console.log('telos updated called. here\'s where we update the telos documents....')
  }

  @MessagePattern({ cmd: AIOrchestrationCommands.REFER_PERSONA })
  async referPersona(data: any) {
    console.log('refer persona called. here\'s where we refer the persona....')
  }
}