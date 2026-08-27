import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AvailabilitiesService } from './availabilities.service';
import { AvailabilityEntity } from './entities/availability.entity';
import { AvailabilityOverrideEntity } from './entities/availability-override.entity';

describe('AvailabilitiesService', () => {
  let availabilityRepository: jest.Mocked<Repository<AvailabilityEntity>>;
  let overrideRepository: jest.Mocked<Repository<AvailabilityOverrideEntity>>;
  let service: AvailabilitiesService;

  beforeEach(() => {
    availabilityRepository = {
      create: jest.fn((payload) => payload as AvailabilityEntity),
      save: jest.fn(
        async (payload) =>
          ({ id: 'availability-1', ...payload } as AvailabilityEntity)
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<AvailabilityEntity>>;
    overrideRepository = {
      create: jest.fn((payload) => payload as AvailabilityOverrideEntity),
      save: jest.fn(
        async (payload) =>
          ({ id: 'override-1', ...payload } as AvailabilityOverrideEntity)
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<AvailabilityOverrideEntity>>;

    service = new AvailabilitiesService(
      availabilityRepository,
      overrideRepository
    );
  });

  it('rejects overlapping weekly availability for the same owner and day', async () => {
    availabilityRepository.find.mockResolvedValue([
      {
        id: 'existing',
        ownerId: 'owner-1',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '11:00:00',
      },
    ] as AvailabilityEntity[]);

    await expect(
      service.create({
        ownerId: 'owner-1',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
        hourlyRate: 150,
        serviceType: 'Consultation',
        isActive: true,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects overlapping availability overrides for the same owner', async () => {
    overrideRepository.find.mockResolvedValue([
      {
        id: 'existing',
        ownerId: 'owner-1',
        startTime: new Date('2026-05-10T14:00:00.000Z'),
        endTime: new Date('2026-05-10T15:00:00.000Z'),
      },
    ] as AvailabilityOverrideEntity[]);

    await expect(
      service.createOverride({
        ownerId: 'owner-1',
        mode: 'blocked' as never,
        startTime: '2026-05-10T14:30:00.000Z' as never,
        endTime: '2026-05-10T15:30:00.000Z' as never,
        hourlyRate: 120,
        serviceType: 'Consultation',
        isActive: true,
      })
    ).rejects.toThrow(BadRequestException);
  });

  describe('ownership enforcement', () => {
    it('rejects updating an availability owned by a different owner', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        id: 'availability-1',
        ownerId: 'owner-1',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '11:00:00',
      } as AvailabilityEntity);

      await expect(
        service.update(
          'availability-1',
          { startTime: '10:00', endTime: '12:00' } as never,
          'attacker-owner'
        )
      ).rejects.toThrow(ForbiddenException);

      expect(availabilityRepository.update).not.toHaveBeenCalled();
    });

    it('allows the recorded owner to update their own availability', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        id: 'availability-1',
        ownerId: 'owner-1',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '11:00:00',
      } as AvailabilityEntity);
      availabilityRepository.find.mockResolvedValue([]);

      await service.update(
        'availability-1',
        { startTime: '10:00', endTime: '12:00' } as never,
        'owner-1'
      );

      expect(availabilityRepository.update).toHaveBeenCalled();
    });

    it('rejects removing an availability owned by a different owner', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        id: 'availability-1',
        ownerId: 'owner-1',
      } as AvailabilityEntity);

      await expect(
        service.remove('availability-1', 'attacker-owner')
      ).rejects.toThrow(ForbiddenException);

      expect(availabilityRepository.delete).not.toHaveBeenCalled();
    });

    it('allows removal when no requester owner id is supplied (internal/trusted callers)', async () => {
      await service.remove('availability-1');

      expect(availabilityRepository.delete).toHaveBeenCalledWith(
        'availability-1'
      );
    });

    it('rejects updating an availability override owned by a different owner', async () => {
      overrideRepository.findOne.mockResolvedValue({
        id: 'override-1',
        ownerId: 'owner-1',
        startTime: new Date('2026-05-10T14:00:00.000Z'),
        endTime: new Date('2026-05-10T15:00:00.000Z'),
      } as AvailabilityOverrideEntity);

      await expect(
        service.updateOverride(
          'override-1',
          { startTime: '2026-05-10T16:00:00.000Z' } as never,
          'attacker-owner'
        )
      ).rejects.toThrow(ForbiddenException);

      expect(overrideRepository.update).not.toHaveBeenCalled();
    });

    it('rejects removing an availability override owned by a different owner', async () => {
      overrideRepository.findOne.mockResolvedValue({
        id: 'override-1',
        ownerId: 'owner-1',
      } as AvailabilityOverrideEntity);

      await expect(
        service.removeOverride('override-1', 'attacker-owner')
      ).rejects.toThrow(ForbiddenException);

      expect(overrideRepository.delete).not.toHaveBeenCalled();
    });
  });
});
