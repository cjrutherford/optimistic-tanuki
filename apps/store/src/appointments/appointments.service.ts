import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  AvailabilityOverrideMode,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  DenyAppointmentDto,
} from '@optimistic-tanuki/models';
import { AppointmentEntity } from './entities/appointment.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { AvailabilityEntity } from './entities/availability.entity';
import { AvailabilityOverrideEntity } from './entities/availability-override.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepository: Repository<AppointmentEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(AvailabilityEntity)
    private readonly availabilityRepository: Repository<AvailabilityEntity>,
    @InjectRepository(AvailabilityOverrideEntity)
    private readonly availabilityOverrideRepository: Repository<AvailabilityOverrideEntity>
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto
  ): Promise<AppointmentEntity> {
    await this.assertAvailableWindow(createAppointmentDto);

    const appointment = this.appointmentRepository.create({
      ...createAppointmentDto,
      status: 'pending',
    });
    return this.appointmentRepository.save(appointment);
  }

  private async assertAvailableWindow(
    createAppointmentDto: CreateAppointmentDto
  ): Promise<void> {
    const start = new Date(createAppointmentDto.startTime);
    const end = new Date(createAppointmentDto.endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException('Booking window is invalid.');
    }

    const overrides = await this.availabilityOverrideRepository.find({
      where: {
        ownerId: createAppointmentDto.ownerId ?? null,
        isActive: true,
        startTime: LessThanOrEqual(end),
        endTime: MoreThanOrEqual(start),
      },
      order: { startTime: 'ASC' },
    });

    const blockingOverride = overrides.find(
      (entry) => entry.mode === AvailabilityOverrideMode.BLOCKED
    );
    if (blockingOverride) {
      throw new BadRequestException('Selected time is unavailable.');
    }

    const openingOverride = overrides.find(
      (entry) => entry.mode === AvailabilityOverrideMode.AVAILABLE
    );
    if (openingOverride) {
      return;
    }

    const dayOfWeek = start.getDay();
    const matchingAvailabilities = await this.availabilityRepository.find({
      where: {
        ownerId: createAppointmentDto.ownerId ?? null,
        dayOfWeek,
        isActive: true,
      },
      order: { startTime: 'ASC' },
    });

    const startClock = this.toTimeString(start);
    const endClock = this.toTimeString(end);
    const match = matchingAvailabilities.find(
      (entry) => entry.startTime <= startClock && entry.endTime >= endClock
    );

    if (!match) {
      throw new BadRequestException(
        'Selected time is outside the published availability.'
      );
    }

    const conflictingAppointments = await this.appointmentRepository.find({
      where: {
        ownerId: createAppointmentDto.ownerId ?? null,
        startTime: LessThanOrEqual(end),
        endTime: MoreThanOrEqual(start),
      } as never,
    });
    const hasConflict = conflictingAppointments.some((appointment) => {
      if (
        appointment.status === 'cancelled' ||
        appointment.status === 'denied'
      ) {
        return false;
      }

      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);
      return appointmentStart < end && appointmentEnd > start;
    });

    if (hasConflict) {
      throw new BadRequestException('Selected time is no longer available.');
    }
  }

  private toTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  async findAll(ownerId?: string | null): Promise<AppointmentEntity[]> {
    return this.appointmentRepository.find({
      where: ownerId ? ({ ownerId } as never) : undefined,
      relations: ['product', 'resource'],
      order: { createdAt: 'DESC' },
    });
  }

  async findUserAppointments(
    userId: string,
    ownerId?: string | null
  ): Promise<AppointmentEntity[]> {
    return this.appointmentRepository.find({
      where: ownerId ? ({ userId, ownerId } as never) : ({ userId } as never),
      relations: ['product', 'resource'],
      order: { createdAt: 'DESC' },
    });
  }

  async findUserInvoices(
    userId: string,
    ownerId?: string | null
  ): Promise<InvoiceEntity[]> {
    if (!ownerId) {
      return this.invoiceRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    }

    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .innerJoin(
        AppointmentEntity,
        'appointment',
        'appointment.id = invoice.appointmentId'
      )
      .where('invoice.userId = :userId', { userId })
      .andWhere('appointment.ownerId = :ownerId', { ownerId })
      .orderBy('invoice.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<AppointmentEntity> {
    return this.appointmentRepository.findOne({
      where: { id },
      relations: ['product', 'resource'],
    });
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto
  ): Promise<AppointmentEntity> {
    await this.appointmentRepository.update(id, updateAppointmentDto);
    return this.findOne(id);
  }

  async approve(
    id: string,
    approveDto: ApproveAppointmentDto
  ): Promise<AppointmentEntity> {
    const appointment = await this.findOne(id);

    // Calculate duration in hours
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);

    // Validate that endTime is after startTime
    if (endTime <= startTime) {
      throw new Error('End time must be after start time');
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Determine hourly rate
    let hourlyRate = approveDto.hourlyRate;

    // If no hourly rate provided and not a free consultation, try to get from availability
    if (!hourlyRate && !appointment.isFreeConsultation) {
      const dayOfWeek = startTime.getDay();
      const availability = await this.availabilityRepository.findOne({
        where: {
          dayOfWeek,
          isActive: true,
        },
      });
      if (availability) {
        hourlyRate = Number(availability.hourlyRate);
      }
    }

    // Calculate total cost
    let totalCost = 0;
    if (!appointment.isFreeConsultation && hourlyRate) {
      totalCost = hourlyRate * durationHours;
    }

    await this.appointmentRepository.update(id, {
      status: 'approved',
      hourlyRate,
      totalCost,
      notes: approveDto.notes,
    });

    return this.findOne(id);
  }

  async deny(
    id: string,
    denyDto: DenyAppointmentDto
  ): Promise<AppointmentEntity> {
    await this.appointmentRepository.update(id, {
      status: 'denied',
      denialReason: denyDto.denialReason,
    });
    return this.findOne(id);
  }

  async cancel(id: string): Promise<AppointmentEntity> {
    await this.appointmentRepository.update(id, { status: 'cancelled' });
    return this.findOne(id);
  }

  async complete(id: string): Promise<AppointmentEntity> {
    await this.appointmentRepository.update(id, { status: 'completed' });
    return this.findOne(id);
  }

  async generateInvoice(id: string): Promise<InvoiceEntity> {
    const appointment = await this.findOne(id);

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'completed') {
      throw new Error('Can only generate invoices for completed appointments');
    }

    if (appointment.isFreeConsultation) {
      throw new Error('Cannot generate invoice for free consultations');
    }

    // Generate invoice number with timestamp and random component for uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const invoiceNumber = `INV-${timestamp}-${random}`;

    const invoice = this.invoiceRepository.create({
      appointmentId: appointment.id,
      userId: appointment.userId,
      invoiceNumber,
      amount: appointment.totalCost || 0,
      currency: 'USD',
      status: 'unpaid',
    });

    return this.invoiceRepository.save(invoice);
  }

  async payInvoice(id: string, userId: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, userId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await this.invoiceRepository.update(id, {
      status: 'paid',
      paidAt: new Date(),
    });

    return this.invoiceRepository.findOne({
      where: { id },
    });
  }
}
