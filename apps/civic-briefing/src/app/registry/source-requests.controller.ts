import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import {
  InvalidSourceRequestError,
  type SourceRequestReply,
  SourceRequestsService,
  type SourceStatusReply,
} from './source-requests.service';

/** Sources status and readers' requests for sources, for the gateway (D32). */
@Controller()
export class SourceRequestsController {
  constructor(private readonly service: SourceRequestsService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.SOURCE_STATUS })
  status(
    @Payload() payload: { slug: string }
  ): Promise<SourceStatusReply | null> {
    return this.service.status(payload.slug);
  }

  @MessagePattern({ cmd: CivicBriefingCommands.REQUEST_SOURCES })
  async request(
    @Payload() payload: { slug: string; userId: string; note?: string }
  ): Promise<SourceRequestReply | null> {
    try {
      return await this.service.request(
        payload.slug,
        payload.userId,
        payload.note
      );
    } catch (error) {
      if (error instanceof InvalidSourceRequestError)
        throw new RpcException({ status: 400, message: error.message });
      throw error;
    }
  }
}
