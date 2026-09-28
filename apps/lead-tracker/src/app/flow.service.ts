import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomInt, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { withTenantRlsTransaction } from '@optimistic-tanuki/business-security';
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
import {
  FlowBooking,
  FLOW_BOOKING_STATUSES,
} from './entities/flow-booking.entity';
import { FlowBookingUpdate } from './entities/flow-booking-update.entity';
import { FlowEstimate } from './entities/flow-estimate.entity';

const FLOW_ARRIVAL_WINDOWS = [
  { id: 'w1', timeSlot: '8:00 AM - 10:00 AM' },
  { id: 'w2', timeSlot: '10:00 AM - 12:00 PM' },
  { id: 'w3', timeSlot: '1:00 PM - 3:00 PM' },
  { id: 'w4', timeSlot: '3:00 PM - 5:00 PM' },
];

const ESTIMATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TAX_RATE = 0.07;
const MAX_DEPOSIT = 50;

type BookingPayload = FlowTenantPayload<CreateBookingDto> & {
  idempotencyKey?: string;
};

type SyncItemPayload = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(
    @Inject('LEAD_TRACKER_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  async calculateEstimate(
    payload: FlowTenantPayload<CreateEstimateDto> & { idempotencyKey?: string }
  ): Promise<EstimateResultDto> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      idempotencyKey,
      ...body
    } = payload;
    const dto = await this.validateDto(CreateEstimateDto, body);
    return this.transact(tenantId, async (manager) => {
      if (idempotencyKey) {
        const existing = await manager.getRepository(FlowEstimate).findOne({
          where: { tenantId, idempotencyKey },
        });
        if (existing) {
          return this.toEstimateResult(existing);
        }
      }
      const pricing = this.priceEstimate(dto);
      const estimate = manager.getRepository(FlowEstimate).create({
        tenantId,
        estimateId: `est_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        idempotencyKey: idempotencyKey ?? null,
        serviceId: dto.serviceId,
        servicePackage: dto.servicePackage,
        serviceName: pricing.serviceName,
        size: dto.size,
        condition: dto.condition,
        squareFootage: dto.squareFootage ?? null,
        tradeType: dto.tradeType ?? null,
        basePrice: pricing.basePrice,
        conditionMultiplier: pricing.conditionMultiplier,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        depositRequired: pricing.depositRequired,
        total: pricing.total,
        currency: 'USD',
        expiresAt: new Date(Date.now() + ESTIMATE_TTL_MS),
        pricingSnapshot: pricing.snapshot,
      });
      const saved = await manager.getRepository(FlowEstimate).save(estimate);
      return this.toEstimateResult(saved);
    });
  }

  async createBooking(payload: BookingPayload): Promise<FlowBookingResponse> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      idempotencyKey,
      ...body
    } = payload;
    const dto = await this.validateDto(CreateBookingDto, body);
    return this.transact(tenantId, async (manager) => {
      const estimate = await manager.getRepository(FlowEstimate).findOne({
        where: { tenantId, estimateId: dto.estimateId },
      });
      if (!estimate) {
        throw new NotFoundException('Estimate not found for this tenant');
      }
      if (estimate.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('Estimate has expired');
      }
      const key = idempotencyKey ?? `estimate:${estimate.estimateId}`;
      const existing = await manager.getRepository(FlowBooking).findOne({
        where: { tenantId, idempotencyKey: key },
      });
      if (existing) {
        return this.toBookingResponse(existing);
      }
      await this.assertWindowAvailable(
        manager,
        tenantId,
        estimate.serviceId,
        dto.scheduledDate,
        dto.arrivalWindow
      );
      const bookingRepo = manager.getRepository(FlowBooking);
      const booking = bookingRepo.create({
        tenantId,
        bookingId: randomUUID(),
        trackingCode: `FLW-${randomInt(100000, 1000000)}`,
        estimateId: estimate.estimateId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        serviceAddress: dto.serviceAddress,
        gateCode: dto.gateCode ?? null,
        serviceId: estimate.serviceId,
        servicePackage: estimate.servicePackage,
        serviceName: estimate.serviceName,
        scheduledDate: dto.scheduledDate,
        arrivalWindow: dto.arrivalWindow,
        photoUrls: dto.photoUrls ?? [],
        totalAmount: Number(estimate.total),
        depositAmount: Number(estimate.depositRequired),
        depositPaid: false,
        status: 'scheduled',
        idempotencyKey: key,
        notes: dto.notes ?? null,
      });
      const saved = await bookingRepo.save(booking);
      await manager.getRepository(FlowBookingUpdate).save(
        manager.getRepository(FlowBookingUpdate).create({
          tenantId,
          bookingId: saved.bookingId,
          previousStatus: null,
          status: 'scheduled',
          actor: 'system',
          note: 'Booking created',
        })
      );
      this.logger.log(`Created Field Flow booking ${saved.bookingId}`);
      return this.toBookingResponse(saved);
    });
  }

  async getStatus(
    payload: FlowTenantPayload<GetFlowStatusDto>
  ): Promise<JobStatusDto> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      ...body
    } = payload;
    const dto = await this.validateDto(GetFlowStatusDto, body);
    return this.transact(tenantId, async (manager) => {
      const booking = await this.findBooking(manager, tenantId, dto.id);
      if (!booking) {
        throw new NotFoundException('Booking not found for this tenant');
      }
      return this.toJobStatus(booking);
    });
  }

  async getAvailability(
    payload: FlowTenantPayload<CreateFlowAvailabilityDto>
  ): Promise<FlowAvailabilityResponse> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      ...body
    } = payload;
    const dto = await this.validateDto(CreateFlowAvailabilityDto, body);
    return this.transact(tenantId, async (manager) => {
      const bookings = await manager.getRepository(FlowBooking).find({
        where: {
          tenantId,
          serviceId: dto.serviceId,
          scheduledDate: dto.date,
        },
      });
      const taken = new Set(
        bookings
          .filter((booking) => booking.status !== 'cancelled')
          .map((booking) => this.normalizeWindow(booking.arrivalWindow))
      );
      return {
        date: dto.date,
        windows: FLOW_ARRIVAL_WINDOWS.map((window) => ({
          ...window,
          available: !taken.has(this.normalizeWindow(window.timeSlot)),
        })),
      };
    });
  }

  async syncFlow(
    payload: FlowTenantPayload<SyncFlowDto>
  ): Promise<FlowSyncResponseDto> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      ...body
    } = payload;
    const dto = await this.validateDto(SyncFlowDto, body);
    const results = [];
    for (const item of dto.items) {
      try {
        await this.syncItem(tenantId, {
          id: item.id,
          type: item.type,
          payload: item.payload,
          idempotencyKey: item.idempotencyKey,
        });
        results.push({ id: item.id, acknowledged: true });
      } catch (error) {
        results.push({
          id: item.id,
          acknowledged: false,
          error: error instanceof Error ? error.message : 'Sync item failed',
        });
      }
    }
    return { results };
  }

  private async syncItem(
    tenantId: string,
    item: SyncItemPayload
  ): Promise<void> {
    switch (item.type) {
      case 'estimate':
        await this.calculateEstimate({
          ...(item.payload as unknown as CreateEstimateDto),
          tenantId,
          idempotencyKey: item.idempotencyKey,
        });
        return;
      case 'booking':
        await this.createBooking({
          ...(item.payload as unknown as CreateBookingDto),
          tenantId,
          idempotencyKey: item.idempotencyKey,
        });
        return;
      case 'completion_note':
        await this.appendNote(tenantId, item.payload);
        return;
      case 'photo':
        await this.attachPhoto(tenantId, item.payload);
        return;
      default:
        throw new BadRequestException(
          `Unsupported sync item type: ${item.type}`
        );
    }
  }

  private async appendNote(
    tenantId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const jobId = this.stringField(payload, 'jobId');
    const notes = this.stringField(payload, 'notes');
    if (!jobId || !notes) {
      throw new BadRequestException('Completion note sync item is invalid');
    }
    await this.transact(tenantId, async (manager) => {
      const booking = await this.findBooking(manager, tenantId, jobId);
      if (!booking) {
        throw new NotFoundException('Booking not found for this tenant');
      }
      await manager.getRepository(FlowBookingUpdate).save(
        manager.getRepository(FlowBookingUpdate).create({
          tenantId,
          bookingId: booking.bookingId,
          previousStatus: booking.status,
          status: booking.status,
          actor: 'technician',
          note: notes,
        })
      );
    });
  }

  private async attachPhoto(
    tenantId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const jobId = this.stringField(payload, 'jobId');
    const photoUrl =
      this.stringField(payload, 'photoUrl') ??
      this.stringField(payload, 'photoUrls');
    if (!jobId || !photoUrl || !/^https?:\/\//.test(photoUrl)) {
      throw new BadRequestException('Photo sync item is invalid');
    }
    await this.transact(tenantId, async (manager) => {
      const booking = await this.findBooking(manager, tenantId, jobId);
      if (!booking) {
        throw new NotFoundException('Booking not found for this tenant');
      }
      booking.photoUrls = [...(booking.photoUrls ?? []), photoUrl];
      await manager.getRepository(FlowBooking).save(booking);
    });
  }

  private async findBooking(
    manager: EntityManager,
    tenantId: string,
    id: string
  ): Promise<FlowBooking | null> {
    return manager.getRepository(FlowBooking).findOne({
      where: [
        { tenantId, bookingId: id },
        { tenantId, trackingCode: id },
      ],
    });
  }

  private async assertWindowAvailable(
    manager: EntityManager,
    tenantId: string,
    serviceId: string,
    scheduledDate: string,
    arrivalWindow: string
  ): Promise<void> {
    const existing = await manager.getRepository(FlowBooking).find({
      where: { tenantId, serviceId, scheduledDate },
    });
    const requested = this.normalizeWindow(arrivalWindow);
    const taken = existing.some(
      (booking) =>
        booking.status !== 'cancelled' &&
        this.normalizeWindow(booking.arrivalWindow) === requested
    );
    if (taken) {
      throw new ConflictException('Arrival window is no longer available');
    }
  }

  private normalizeWindow(window: string): string {
    return window
      .replace(/^0(\d)/, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private transact<T>(
    tenantId: string,
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    return withTenantRlsTransaction(this.dataSource, tenantId, (manager) =>
      operation(manager as unknown as EntityManager)
    );
  }

  private priceEstimate(dto: CreateEstimateDto): {
    serviceName: string;
    basePrice: number;
    conditionMultiplier: number;
    subtotal: number;
    taxAmount: number;
    depositRequired: number;
    total: number;
    snapshot: Record<string, unknown>;
  } {
    const serviceText = `${dto.servicePackage} ${dto.serviceId}`.toLowerCase();
    const basePrice = serviceText.includes('restoration')
      ? 360
      : serviceText.includes('premium')
      ? 220
      : 120;
    const sizeMultiplier =
      dto.size === 'midsize'
        ? 1.25
        : dto.size === 'large'
        ? 1.5
        : dto.size === 'commercial'
        ? 2
        : 1;
    const conditionSurcharge =
      dto.condition === 'moderate'
        ? 35
        : dto.condition === 'heavy'
        ? 75
        : dto.condition === 'severe'
        ? 140
        : 0;
    const squareFootageAdder =
      dto.squareFootage && dto.squareFootage > 500
        ? Math.round((dto.squareFootage - 500) * 0.2)
        : 0;
    const conditionMultiplier =
      dto.condition === 'moderate'
        ? 1.15
        : dto.condition === 'heavy'
        ? 1.3
        : dto.condition === 'severe'
        ? 1.5
        : 1;
    const subtotal =
      Math.round(
        (basePrice * sizeMultiplier + conditionSurcharge + squareFootageAdder) *
          100
      ) / 100;
    const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const depositRequired = Math.min(
      MAX_DEPOSIT,
      Math.round(subtotal * 0.25 * 100) / 100
    );
    return {
      serviceName: this.humanize(dto.servicePackage || dto.serviceId),
      basePrice,
      conditionMultiplier,
      subtotal,
      taxAmount,
      depositRequired,
      total,
      snapshot: {
        servicePackage: dto.servicePackage,
        serviceId: dto.serviceId,
        size: dto.size,
        condition: dto.condition,
        squareFootage: dto.squareFootage ?? null,
        tradeType: dto.tradeType ?? null,
        basePrice,
        sizeMultiplier,
        conditionSurcharge,
        squareFootageAdder,
        taxRate: TAX_RATE,
      },
    };
  }

  private humanize(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private toEstimateResult(estimate: FlowEstimate): EstimateResultDto {
    return {
      estimateId: estimate.estimateId,
      serviceId: estimate.serviceId,
      serviceName: estimate.serviceName,
      basePrice: Number(estimate.basePrice),
      conditionMultiplier: Number(estimate.conditionMultiplier),
      subtotal: Number(estimate.subtotal),
      taxAmount: Number(estimate.taxAmount),
      depositRequired: Number(estimate.depositRequired),
      total: Number(estimate.total),
      currency: estimate.currency,
      expiresAt: estimate.expiresAt.toISOString(),
    };
  }

  private toBookingResponse(booking: FlowBooking): FlowBookingResponse {
    return {
      bookingId: booking.bookingId,
      trackingCode: booking.trackingCode,
      status: booking.status,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      serviceAddress: booking.serviceAddress,
      scheduledDate: booking.scheduledDate,
      arrivalWindow: booking.arrivalWindow,
      serviceName: booking.serviceName,
      totalAmount: Number(booking.totalAmount),
      depositAmount: Number(booking.depositAmount),
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private toJobStatus(booking: FlowBooking): JobStatusDto {
    return {
      id: booking.bookingId,
      bookingId: booking.bookingId,
      trackingCode: booking.trackingCode,
      status: booking.status,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      serviceName: booking.serviceName,
      serviceAddress: booking.serviceAddress,
      scheduledDate: booking.scheduledDate,
      arrivalWindow: booking.arrivalWindow,
      depositPaid: booking.depositPaid,
      depositAmount: Number(booking.depositAmount),
      totalAmount: Number(booking.totalAmount),
      reviewPromptEligible: booking.status === 'completed',
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private requireTenantId(payload: { tenantId?: unknown }): string {
    if (typeof payload.tenantId !== 'string' || !payload.tenantId.trim()) {
      throw new BadRequestException('Tenant context is required');
    }
    return payload.tenantId;
  }

  private async validateDto<T extends object>(
    type: new () => T,
    value: unknown
  ): Promise<T> {
    const instance = plainToInstance(type, value);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException('Invalid Flow payload');
    }
    return instance;
  }

  private stringField(
    payload: Record<string, unknown>,
    key: string
  ): string | null {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
