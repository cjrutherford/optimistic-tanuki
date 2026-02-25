import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyFourEntity } from '../entities/daily-four.entity';
import { RpcException } from '@nestjs/microservices';

export interface CreateDailyFourDto {
  affirmation: string;
  mindfulActivity: string;
  gratitude: string;
  plannedPleasurable: string;
  public?: boolean;
}

export type UpdateDailyFourDto = Partial<CreateDailyFourDto>

@Injectable()
export class DailyFourService {
  private readonly logger = new Logger(DailyFourService.name);

  constructor(
    @Inject(getRepositoryToken(DailyFourEntity))
    private readonly repository: Repository<DailyFourEntity>
  ) {}

  async create(
    profileId: string,
    dto: CreateDailyFourDto
  ): Promise<DailyFourEntity> {
    this.logger.log(`Creating DailyFour for profile ${profileId}`);

    const entry = this.repository.create({
      ...dto,
      profileId,
      public: dto.public ?? false,
    });

    return this.repository.save(entry);
  }

  async findByProfileId(profileId: string): Promise<DailyFourEntity[]> {
    return this.repository.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(publicOnly?: boolean): Promise<DailyFourEntity[]> {
    const query = this.repository
      .createQueryBuilder('entry')
      .orderBy('entry.createdAt', 'DESC');

    if (publicOnly) {
      query.where('entry.public = :public', { public: true });
    }

    return query.getMany();
  }

  async update(
    id: string,
    profileId: string,
    dto: UpdateDailyFourDto
  ): Promise<DailyFourEntity> {
    const entry = await this.repository.findOne({ where: { id } });

    if (!entry) {
      throw new RpcException('DailyFour entry not found');
    }

    if (entry.profileId !== profileId) {
      throw new RpcException('Not authorized to update this entry');
    }

    Object.assign(entry, dto);
    return this.repository.save(entry);
  }

  async delete(id: string, profileId: string): Promise<void> {
    const entry = await this.repository.findOne({ where: { id } });

    if (!entry) {
      throw new RpcException('DailyFour entry not found');
    }

    if (entry.profileId !== profileId) {
      throw new RpcException('Not authorized to delete this entry');
    }

    await this.repository.remove(entry);
  }
}
