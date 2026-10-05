import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { PipelineHealthService } from './pipeline-health.service';

/** Pipeline health for the operators' page (P5.2). */
@Controller()
export class HealthController {
  constructor(private readonly health: PipelineHealthService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.PIPELINE_HEALTH })
  pipeline() {
    return this.health.report();
  }
}
