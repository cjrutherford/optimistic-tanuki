import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  DenyAppointmentDto,
} from '@optimistic-tanuki/models';
import { AppointmentEntity } from './entities/appointment.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { AvailabilityEntity } from './entities/availability.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepository: Repository<AppointmentEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(AvailabilityEntity)
    private readonly availabilityRepository: Repository<AvailabilityEntity>
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto
  ): Promise<AppointmentEntity> {
    const appointment = this.appointmentRepository.create({
      ...createAppointmentDto,
      status: 'pending',
    });
    return this.appointmentRepository.save(appointment);
  }

  async findAll(): Promise<AppointmentEntity[]> {
    return this.appointmentRepository.find({
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findUserAppointments(userId: string): Promise<AppointmentEntity[]> {
    return this.appointmentRepository.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AppointmentEntity> {
    return this.appointmentRepository.findOne({
      where: { id },
      relations: ['product'],
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
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
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
}
