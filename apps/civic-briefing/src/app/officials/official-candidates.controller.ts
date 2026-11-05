import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import {
  type AcceptOfficialCandidateInput,
  InvalidOfficialCandidateError,
  type OfficialCandidateReply,
  OfficialCandidatesService,
} from './official-candidates.service';

/** Operators' review of agenda-extracted official names, for the gateway (D33). */
@Controller()
export class OfficialCandidatesController {
  constructor(private readonly service: OfficialCandidatesService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.OFFICIAL_CANDIDATES })
  list(
    @Payload() payload?: { slug?: string; status?: string }
  ): Promise<OfficialCandidateReply[]> {
    return this.guard(() => this.service.list(payload ?? {}));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.ACCEPT_OFFICIAL_CANDIDATE })
  accept(
    @Payload() payload: AcceptOfficialCandidateInput
  ): Promise<OfficialCandidateReply | null> {
    return this.guard(() => this.service.accept(payload));
  }

  @MessagePattern({ cmd: CivicBriefingCommands.REJECT_OFFICIAL_CANDIDATE })
  reject(
    @Payload() payload: { id: string; decidedBy: string }
  ): Promise<OfficialCandidateReply | null> {
    return this.guard(() => this.service.reject(payload));
  }

  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidOfficialCandidateError)
        throw new RpcException({ status: 400, message: error.message });
      throw error;
    }
  }
}
