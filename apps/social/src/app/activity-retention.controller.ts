import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ActivityRetentionService } from '@optimistic-tanuki/logger';
/** Private operational readback: aggregate counts only, no mutation or identities. */
@Controller()
export class ActivityRetentionController {
  constructor(private readonly retention: ActivityRetentionService) {}
  @MessagePattern({ cmd: 'account-activity-retention.status' })
  status() {
    return this.retention.readback();
  }
}
