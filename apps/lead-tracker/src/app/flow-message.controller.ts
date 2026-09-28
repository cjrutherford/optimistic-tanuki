import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  FLOW_CALCULATE_ESTIMATE,
  FLOW_CREATE_BOOKING,
  FLOW_GET_AVAILABILITY,
  FLOW_GET_STATUS,
  FLOW_SYNC,
} from '@optimistic-tanuki/constants';
import {
  CreateBookingDto,
  CreateEstimateDto,
  CreateFlowAvailabilityDto,
  EstimateResultDto,
  FlowAvailabilityResponse,
  FlowBookingResponse,
  FlowSyncResponseDto,
  FlowTenantPayload,
  GetFlowStatusDto,
  JobStatusDto,
  SyncFlowDto,
} from '@optimistic-tanuki/models';
import { FlowService } from './flow.service';

@Controller()
export class FlowMessageController {
  constructor(private readonly flowService: FlowService) {}

  @MessagePattern(FLOW_CALCULATE_ESTIMATE)
  @MessagePattern({ cmd: FLOW_CALCULATE_ESTIMATE })
  async calculateEstimate(
    @Payload() payload: FlowTenantPayload<CreateEstimateDto>
  ): Promise<EstimateResultDto> {
    return this.flowService.calculateEstimate(payload);
  }

  @MessagePattern(FLOW_CREATE_BOOKING)
  @MessagePattern({ cmd: FLOW_CREATE_BOOKING })
  async createBooking(
    @Payload() payload: FlowTenantPayload<CreateBookingDto>
  ): Promise<FlowBookingResponse> {
    return this.flowService.createBooking(payload);
  }

  @MessagePattern(FLOW_GET_STATUS)
  @MessagePattern({ cmd: FLOW_GET_STATUS })
  async getStatus(
    @Payload() payload: FlowTenantPayload<GetFlowStatusDto>
  ): Promise<JobStatusDto> {
    return this.flowService.getStatus(payload);
  }

  @MessagePattern(FLOW_GET_AVAILABILITY)
  @MessagePattern({ cmd: FLOW_GET_AVAILABILITY })
  async getAvailability(
    @Payload() payload: FlowTenantPayload<CreateFlowAvailabilityDto>
  ): Promise<FlowAvailabilityResponse> {
    return this.flowService.getAvailability(payload);
  }

  @MessagePattern(FLOW_SYNC)
  @MessagePattern({ cmd: FLOW_SYNC })
  async syncFlow(
    @Payload() payload: FlowTenantPayload<SyncFlowDto>
  ): Promise<FlowSyncResponseDto> {
    return this.flowService.syncFlow(payload);
  }
}
