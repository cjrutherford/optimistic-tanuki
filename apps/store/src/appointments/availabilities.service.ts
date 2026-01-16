import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from '@optimistic-tanuki/models';
import { AvailabilityEntity } from './entities/availability.entity';

@Injectable()
export class AvailabilitiesService {
  constructor(
    @InjectRepository(AvailabilityEntity)
    private readonly availabilityRepository: Repository<AvailabilityEntity>
  ) {}

  async create(
    createAvailabilityDto: CreateAvailabilityDto
  ): Promise<AvailabilityEntity> {
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
    await this.availabilityRepository.update(id, updateAvailabilityDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.availabilityRepository.delete(id);
  }
}
