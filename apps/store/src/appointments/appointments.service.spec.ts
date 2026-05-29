import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AvailabilityOverrideMode } from '@optimistic-tanuki/models';
import { AppointmentsService } from './appointments.service';
import { AppointmentEntity } from './entities/appointment.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { AvailabilityEntity } from './entities/availability.entity';
import { AvailabilityOverrideEntity } from './entities/availability-override.entity';

describe('AppointmentsService', () => {
  let appointmentRepository: jest.Mocked<Repository<AppointmentEntity>>;
  let invoiceRepository: jest.Mocked<Repository<InvoiceEntity>>;
  let availabilityRepository: jest.Mocked<Repository<AvailabilityEntity>>;
  let availabilityOverrideRepository: jest.Mocked<
    Repository<AvailabilityOverrideEntity>
  >;
  let service: AppointmentsService;

  beforeEach(() => {
    appointmentRepository = {
      create: jest.fn((payload) => payload as AppointmentEntity),
      save: jest.fn(
        async (payload) =>
          ({ id: 'booking-1', ...payload } as AppointmentEntity)
      ),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<AppointmentEntity>>;
    invoiceRepository = {} as jest.Mocked<Repository<InvoiceEntity>>;
    availabilityRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<AvailabilityEntity>>;
    availabilityOverrideRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<AvailabilityOverrideEntity>>;

    service = new AppointmentsService(
      appointmentRepository,
      invoiceRepository,
      availabilityRepository,
      availabilityOverrideRepository
    );
  });

  it('creates a pending appointment when the requested window matches recurring availability', async () => {
    availabilityOverrideRepository.find.mockResolvedValue([]);
    availabilityRepository.find.mockResolvedValue([
      {
        id: 'availability-1',
        dayOfWeek: 0,
        startTime: '14:00:00',
        endTime: '16:00:00',
        hourlyRate: 120,
        isActive: true,
      },
    ] as AvailabilityEntity[]);
    appointmentRepository.find.mockResolvedValue([]);

    await expect(
      service.create({
        userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        title: 'Consultation',
        startTime: new Date('2026-05-10T14:00:00'),
        endTime: new Date('2026-05-10T15:00:00'),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'booking-1',
        status: 'pending',
      })
    );
  });

  it('rejects booking windows that fall outside published recurring availability', async () => {
    availabilityOverrideRepository.find.mockResolvedValue([]);
    availabilityRepository.find.mockResolvedValue([
      {
        id: 'availability-1',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '10:00:00',
        hourlyRate: 120,
        isActive: true,
      },
    ] as AvailabilityEntity[]);
    appointmentRepository.find.mockResolvedValue([]);

    await expect(
      service.create({
        userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        title: 'Consultation',
        startTime: new Date('2026-05-10T14:00:00'),
        endTime: new Date('2026-05-10T15:00:00'),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects booking windows blocked by date-specific overrides', async () => {
    availabilityOverrideRepository.find.mockResolvedValue([
      {
        id: 'override-1',
        mode: AvailabilityOverrideMode.BLOCKED,
        startTime: new Date('2026-05-10T14:00:00'),
        endTime: new Date('2026-05-10T15:30:00'),
        isActive: true,
      },
    ] as AvailabilityOverrideEntity[]);
    availabilityRepository.find.mockResolvedValue([
      {
        id: 'availability-1',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '17:00:00',
        hourlyRate: 120,
        isActive: true,
      },
    ] as AvailabilityEntity[]);
    appointmentRepository.find.mockResolvedValue([]);

    await expect(
      service.create({
        userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        title: 'Consultation',
        startTime: new Date('2026-05-10T14:00:00'),
        endTime: new Date('2026-05-10T15:00:00'),
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects booking windows that overlap an existing appointment', async () => {
    availabilityOverrideRepository.find.mockResolvedValue([]);
    availabilityRepository.find.mockResolvedValue([
      {
        id: 'availability-1',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '17:00:00',
        hourlyRate: 120,
        isActive: true,
      },
    ] as AvailabilityEntity[]);
    appointmentRepository.find.mockResolvedValue([
      {
        id: 'booking-existing',
        userId: 'client-2',
        startTime: new Date('2026-05-10T14:30:00'),
        endTime: new Date('2026-05-10T15:30:00'),
        status: 'approved',
      },
    ] as AppointmentEntity[]);

    await expect(
      service.create({
        userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        title: 'Consultation',
        startTime: new Date('2026-05-10T14:00:00'),
        endTime: new Date('2026-05-10T15:00:00'),
      })
    ).rejects.toThrow(BadRequestException);
  });
});
