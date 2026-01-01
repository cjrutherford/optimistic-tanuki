import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { CommonCommands } from '@optimistic-tanuki/constants';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: CommonCommands.HealthCheck })
  healthCheck() {
    return { status: 'healthy' };
  }

  @Get()
  getData() {
    return this.appService.getData();
  }
}
