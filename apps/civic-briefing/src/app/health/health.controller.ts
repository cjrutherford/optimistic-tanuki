import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import type { BackfillRequest } from '@optimistic-tanuki/models';
import { BackfillService } from './backfill.service';
import { PipelineHealthService } from './pipeline-health.service';

/** Pipeline health (P5.2) and backfills (D31) for the operators' page. */
@Controller()
export class HealthController {
  constructor(
    private readonly health: PipelineHealthService,
    private readonly backfills: BackfillService
  ) {}

  @MessagePattern({ cmd: CivicBriefingCommands.BACKFILL_START })
  startBackfill(@Payload() request: BackfillRequest) {
    return this.backfills.start(request ?? {});
  }

  @MessagePattern({ cmd: CivicBriefingCommands.BACKFILL_STATUS })
  backfillStatus() {
    return this.backfills.status();
  }

  @MessagePattern({ cmd: CivicBriefingCommands.PIPELINE_HEALTH })
  pipeline() {
    return this.health.report();
  }
}
