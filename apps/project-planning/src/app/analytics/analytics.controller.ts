import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AnalyticsService } from './analytics.service';
import { QueryAnalyticsDto } from '@optimistic-tanuki/models';
import { AnalyticsCommands } from '@optimistic-tanuki/constants';

@Controller()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @MessagePattern({ cmd: AnalyticsCommands.GET_TASK_ANALYTICS })
  async getTaskAnalytics(@Payload() query: QueryAnalyticsDto) {
    return await this.service.getTaskAnalytics(query);
  }

  @MessagePattern({ cmd: AnalyticsCommands.GET_PROJECT_ANALYTICS })
  async getProjectAnalytics(@Payload() query: QueryAnalyticsDto) {
    return await this.service.getProjectAnalytics(query);
  }

  @MessagePattern({ cmd: AnalyticsCommands.GET_TAG_ANALYTICS })
  async getTagAnalytics(@Payload() query: QueryAnalyticsDto) {
    return await this.service.getTagAnalytics(query);
  }
}
