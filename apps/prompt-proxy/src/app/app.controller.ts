import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern } from '@nestjs/microservices';
import { PromptCommands } from '@optimistic-tanuki/constants';
import { GeneratePrompt } from '@optimistic-tanuki/models'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: PromptCommands.SEND })
  async sendMessage(data: GeneratePrompt) {
    return this.appService.sendMessage(data);
  }
}
