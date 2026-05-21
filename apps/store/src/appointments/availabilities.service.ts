import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateAvailabilityDto,
  CreateAvailabilityOverrideDto,
  UpdateAvailabilityDto,
  UpdateAvailabilityOverrideDto,
} from '@optimistic-tanuki/models';
import { AvailabilityEntity } from './entities/availability.entity';
import { AvailabilityOverrideEntity } from './entities/availability-override.entity';

@Injectable()
export class AvailabilitiesService {
  constructor(
    @InjectRepository(AvailabilityEntity)
    private readonly availabilityRepository: Repository<AvailabilityEntity>,
    @InjectRepository(AvailabilityOverrideEntity)
    private readonly availabilityOverrideRepository: Repository<AvailabilityOverrideEntity>
  ) {}

  async create(
    createAvailabilityDto: CreateAvailabilityDto
  ): Promise<AvailabilityEntity> {
    await this.assertAvailabilityDoesNotOverlap(createAvailabilityDto);
    const availability = this.availabilityRepository.create(
      createAvailabilityDto
    );
    return this.availabilityRepository.save(availability);
  }

  async findAll(): Promise<AvailabilityEntity[]> {
    return this.availabilityRepository.find({
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async findOwnerAvailabilities(
    ownerId: string
  ): Promise<AvailabilityEntity[]> {
    return this.availabilityRepository.find({
      where: { ownerId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(id: string): Promise<AvailabilityEntity> {
    return this.availabilityRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    updateAvailabilityDto: UpdateAvailabilityDto
  ): Promise<AvailabilityEntity> {
    const current = await this.findOne(id);
    await this.assertAvailabilityDoesNotOverlap(
      {
        ...current,
        ...updateAvailabilityDto,
      },
      id
    );
    await this.availabilityRepository.update(id, updateAvailabilityDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.availabilityRepository.delete(id);
  }

  async createOverride(
    createAvailabilityOverrideDto: CreateAvailabilityOverrideDto
  ): Promise<AvailabilityOverrideEntity> {
    await this.assertOverrideDoesNotOverlap(createAvailabilityOverrideDto);
    const override = this.availabilityOverrideRepository.create(
      createAvailabilityOverrideDto
    );
    return this.availabilityOverrideRepository.save(override);
  }

  async findAllOverrides(): Promise<AvailabilityOverrideEntity[]> {
    return this.availabilityOverrideRepository.find({
      order: { startTime: 'ASC' },
    });
  }

  async findOwnerAvailabilityOverrides(
    ownerId: string
  ): Promise<AvailabilityOverrideEntity[]> {
    return this.availabilityOverrideRepository.find({
      where: { ownerId },
      order: { startTime: 'ASC' },
    });
  }

  async findOneOverride(id: string): Promise<AvailabilityOverrideEntity> {
    return this.availabilityOverrideRepository.findOne({ where: { id } });
  }

  async updateOverride(
    id: string,
    updateAvailabilityOverrideDto: UpdateAvailabilityOverrideDto
  ): Promise<AvailabilityOverrideEntity> {
    const current = await this.findOneOverride(id);
    await this.assertOverrideDoesNotOverlap(
      {
        ...current,
        ...updateAvailabilityOverrideDto,
      },
      id
    );
    await this.availabilityOverrideRepository.update(
      id,
      updateAvailabilityOverrideDto
    );
    return this.findOneOverride(id);
  }

  async removeOverride(id: string): Promise<void> {
    await this.availabilityOverrideRepository.delete(id);
  }

  private async assertAvailabilityDoesNotOverlap(
    payload: {
      ownerId?: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    },
    excludeId?: string
  ): Promise<void> {
    const start = this.normalizeTime(payload.startTime);
    const end = this.normalizeTime(payload.endTime);
    if (end <= start) {
      throw new BadRequestException(
        'Availability end time must be after start time.'
      );
    }

    const existing = await this.availabilityRepository.find({
      where: {
        ownerId: payload.ownerId ?? null,
        dayOfWeek: payload.dayOfWeek,
      },
    });

    const overlaps = existing.some((entry) => {
      if (excludeId && entry.id === excludeId) {
        return false;
      }

      return this.timeRangesOverlap(
        start,
        end,
        this.normalizeTime(entry.startTime),
        this.normalizeTime(entry.endTime)
      );
    });

    if (overlaps) {
      throw new BadRequestException(
        'Availability cannot overlap an existing time block.'
      );
    }
  }

  private async assertOverrideDoesNotOverlap(
    payload: {
      ownerId?: string | null;
      startTime: string | Date;
      endTime: string | Date;
    },
    excludeId?: string
  ): Promise<void> {
    const start = new Date(payload.startTime);
    const end = new Date(payload.endTime);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'Availability override end time must be after start time.'
      );
    }

    const existing = await this.availabilityOverrideRepository.find({
      where: {
        ownerId: payload.ownerId ?? null,
      },
    });

    const overlaps = existing.some((entry) => {
      if (excludeId && entry.id === excludeId) {
        return false;
      }

      return this.dateRangesOverlap(
        start,
        end,
        new Date(entry.startTime),
        new Date(entry.endTime)
      );
    });

    if (overlaps) {
      throw new BadRequestException(
        'Availability override cannot overlap an existing override.'
      );
    }
  }

  private normalizeTime(value: string): string {
    const [hours = '00', minutes = '00', seconds = '00'] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(
      2,
      '0'
    )}:${seconds.padStart(2, '0')}`;
  }

  private timeRangesOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ): boolean {
    return startA < endB && startB < endA;
  }

  private dateRangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date
  ): boolean {
    return (
      startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
    );
  }
}
