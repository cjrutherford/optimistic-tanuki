import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern } from '@nestjs/microservices';
import { CommonCommands } from '@optimistic-tanuki/constants';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: CommonCommands.HealthCheck })
  healthCheck() {
    console.log('Health check received');
    return { status: 'healthy' };
  }

  @Get()
  getData() {
    return this.appService.getData();
  }
}
