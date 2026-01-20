import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateResourceDto,
  UpdateResourceDto,
} from '@optimistic-tanuki/models';
import { ResourceEntity } from './entities/resource.entity';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(ResourceEntity)
    private readonly resourceRepository: Repository<ResourceEntity>
  ) {}

  async create(createResourceDto: CreateResourceDto): Promise<ResourceEntity> {
    const resource = this.resourceRepository.create(createResourceDto);
    return this.resourceRepository.save(resource);
  }

  async findAll(): Promise<ResourceEntity[]> {
    return this.resourceRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findByType(type: string): Promise<ResourceEntity[]> {
    return this.resourceRepository.find({
      where: { type, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ResourceEntity> {
    return this.resourceRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    updateResourceDto: UpdateResourceDto
  ): Promise<ResourceEntity> {
    await this.resourceRepository.update(id, updateResourceDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.resourceRepository.delete(id);
  }

  async checkAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Check if resource has any conflicting appointments
    const conflictingAppointments = await this.resourceRepository.query(
      `
      SELECT COUNT(*) as count
      FROM appointments
      WHERE "resourceId" = $1
        AND status NOT IN ('cancelled', 'denied')
        AND (
          ("startTime" <= $2 AND "endTime" > $2) OR
          ("startTime" < $3 AND "endTime" >= $3) OR
          ("startTime" >= $2 AND "endTime" <= $3)
        )
      `,
      [resourceId, startTime, endTime]
    );

    return parseInt(conflictingAppointments[0].count) === 0;
  }
}
