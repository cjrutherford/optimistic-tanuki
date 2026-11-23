import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import {
  type ClearOverrideInput,
  type DecideRequestInput,
  InvalidSourceOpError,
  type PageInput,
  type SetOverrideInput,
  SourceOpsService,
  SourceRequestDecidedError,
} from './source-ops.service';

/** The sources admin for the gateway's operator routes (SD.6). */
@Controller()
export class SourceOpsController {
  constructor(private readonly service: SourceOpsService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_DECISIONS })
  decisions(@Payload() payload: { slug: string } & PageInput) {
    return this.guard(() => this.service.decisionLog(payload.slug, payload));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_OVERRIDES })
  overrides(@Payload() payload?: { slug?: string }) {
    return this.guard(() => this.service.overrides(payload?.slug));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_OVERRIDE_SET })
  setOverride(@Payload() payload: SetOverrideInput) {
    return this.guard(() => this.service.setOverride(payload));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_OVERRIDE_CLEAR })
  clearOverride(@Payload() payload: ClearOverrideInput) {
    return this.guard(() => this.service.clearOverride(payload));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_HEALTH })
  health(@Payload() payload: { slug: string }) {
    return this.guard(() => this.service.health(payload.slug));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_REQUESTS })
  requests(
    @Payload() payload?: PageInput & { slug?: string; status?: string }
  ) {
    return this.guard(() => this.service.listRequests(payload ?? {}));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_REQUEST_DECIDE })
  decide(@Payload() payload: DecideRequestInput) {
    return this.guard(() => this.service.decideRequest(payload));
  }

  /** A refused value is the operator's to fix (400); a decided request is 409. */
  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidSourceOpError)
        throw new RpcException({ status: 400, message: error.message });
      if (error instanceof SourceRequestDecidedError)
        throw new RpcException({ status: 409, message: error.message });
      throw error;
    }
  }
}
