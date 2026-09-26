import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Inject,
  Logger,
  HttpStatus,
  HttpCode,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  FLOW_CALCULATE_ESTIMATE,
  FLOW_CREATE_BOOKING,
  FLOW_PROCESS_DEPOSIT,
  FLOW_GET_STATUS,
  FLOW_GET_AVAILABILITY,
  FlowCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateEstimateDto,
  EstimateResultDto,
  CreateBookingDto,
  CreateFlowAvailabilityDto,
  DepositPaymentDto,
  FlowAvailabilityResponse,
  JobStatusDto,
  SyncFlowDto,
} from '@optimistic-tanuki/models';
import { Public } from '../../decorators/public.decorator';
import { TenantContextGuard } from '../../guards/tenant-context.guard';

type FlowRequest = {
  tenantId?: string;
  tenantContext?: unknown;
};

type FlowInternalContext = {
  tenantId: string;
  tenantContext: unknown;
};

@ApiTags('flow')
@Controller(['v1/flow', 'flow'])
@UseGuards(TenantContextGuard)
export class FlowController {
  private readonly logger = new Logger(FlowController.name);

  constructor(
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadTrackerClient: ClientProxy,
    @Inject(ServiceTokens.PAYMENTS_SERVICE)
    private readonly paymentsClient: ClientProxy
  ) {}

  @Public()
  @Post('estimates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate real-time trade estimate' })
  @ApiResponse({
    status: 200,
    description: 'Calculated quote result',
    type: EstimateResultDto,
  })
  async calculateEstimate(
    @Body() dto: CreateEstimateDto,
    @Req() req: FlowRequest
  ): Promise<EstimateResultDto> {
    this.logger.log(`Calculating estimate for service ${dto.serviceId}`);
    return firstValueFrom(
      this.leadTrackerClient.send<EstimateResultDto>(
        FLOW_CALCULATE_ESTIMATE,
        this.withTenantContext(dto, req)
      )
    );
  }

  @Public()
  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new field flow booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @Req() req: FlowRequest
  ): Promise<unknown> {
    this.logger.log(`Creating booking for ${dto.customerName}`);
    return firstValueFrom(
      this.leadTrackerClient.send(
        FLOW_CREATE_BOOKING,
        this.withTenantContext(dto, req)
      )
    );
  }

  @Post('payments/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process Stripe deposit payment for booking' })
  @ApiResponse({
    status: 200,
    description: 'Payment intent created and SMS dispatched',
  })
  async processDeposit(
    @Body() dto: DepositPaymentDto,
    @Req() req: FlowRequest
  ): Promise<unknown> {
    this.logger.log(
      `Processing deposit for booking ${dto.bookingId ?? dto.trackingCode}`
    );
    return firstValueFrom(
      this.paymentsClient.send(
        FLOW_PROCESS_DEPOSIT,
        this.withTenantContext(dto, req)
      )
    );
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Synchronize offline field-flow actions' })
  @ApiResponse({ status: 200, description: 'Synchronized field-flow actions' })
  async sync(
    @Body() dto: SyncFlowDto,
    @Req() req: FlowRequest
  ): Promise<unknown> {
    this.logger.log(`Synchronizing ${dto.items.length} field-flow actions`);
    return firstValueFrom(
      this.leadTrackerClient.send(
        FlowCommands.SYNC,
        this.withTenantContext(dto, req)
      )
    );
  }

  @Public()
  @Get('availability')
  @ApiOperation({ summary: 'Get available service arrival windows' })
  @ApiResponse({ status: 200, description: 'Available arrival windows' })
  async getAvailability(
    @Query() dto: CreateFlowAvailabilityDto,
    @Req() req: FlowRequest
  ): Promise<FlowAvailabilityResponse> {
    return firstValueFrom(
      this.leadTrackerClient.send<FlowAvailabilityResponse>(
        FLOW_GET_AVAILABILITY,
        this.withTenantContext(dto, req)
      )
    );
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get current job and dispatch status' })
  @ApiResponse({
    status: 200,
    description: 'Job dispatch status',
    type: JobStatusDto,
  })
  async getStatus(
    @Param('id') id: string,
    @Req() req: FlowRequest
  ): Promise<JobStatusDto> {
    this.logger.log(`Retrieving status for job ${id}`);
    return firstValueFrom(
      this.leadTrackerClient.send<JobStatusDto>(
        FLOW_GET_STATUS,
        this.withTenantContext({ id }, req)
      )
    );
  }

  @Public()
  @Get('tenant')
  @ApiOperation({ summary: 'Get current resolved tenant configuration' })
  getCurrentTenant(@Req() req: FlowRequest): unknown {
    const context = this.requireTenantContext(req);
    return {
      tenantId: context.tenantId,
      profileId: context.tenantId,
      matchedBy:
        typeof context.tenantContext === 'object' &&
        context.tenantContext !== null &&
        'matchedBy' in context.tenantContext
          ? context.tenantContext.matchedBy
          : null,
      matchedValue:
        typeof context.tenantContext === 'object' &&
        context.tenantContext !== null &&
        'matchedValue' in context.tenantContext
          ? context.tenantContext.matchedValue
          : null,
      tenant:
        typeof context.tenantContext === 'object' &&
        context.tenantContext !== null &&
        'tenant' in context.tenantContext
          ? context.tenantContext.tenant
          : null,
    };
  }

  private requireTenantContext(req: FlowRequest): FlowInternalContext {
    if (!req?.tenantId || !req.tenantContext) {
      throw new NotFoundException('Tenant context is required');
    }
    return { tenantId: req.tenantId, tenantContext: req.tenantContext };
  }

  private withTenantContext<T extends object>(
    payload: T,
    req: FlowRequest
  ): T & FlowInternalContext {
    return {
      ...payload,
      ...this.requireTenantContext(req),
    };
  }
}
