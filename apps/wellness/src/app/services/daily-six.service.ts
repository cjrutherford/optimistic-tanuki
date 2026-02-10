import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailySixEntity } from '../entities/daily-six.entity';
import { RpcException } from '@nestjs/microservices';

export interface CreateDailySixDto {
  affirmation: string;
  judgement: string;
  nonJudgement: string;
  mindfulActivity: string;
  gratitude: string;
  public?: boolean;
}

export interface UpdateDailySixDto extends Partial<CreateDailySixDto> {}

@Injectable()
export class DailySixService {
  private readonly logger = new Logger(DailySixService.name);

  constructor(
    @Inject(getRepositoryToken(DailySixEntity))
    private readonly repository: Repository<DailySixEntity>
  ) {}

  async create(
    profileId: string,
    dto: CreateDailySixDto
  ): Promise<DailySixEntity> {
    this.logger.log(`Creating DailySix for profile ${profileId}`);

    const entry = this.repository.create({
      ...dto,
      profileId,
      public: dto.public ?? false,
    });

    return this.repository.save(entry);
  }

  async findByProfileId(profileId: string): Promise<DailySixEntity[]> {
    return this.repository.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(publicOnly?: boolean): Promise<DailySixEntity[]> {
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
    dto: UpdateDailySixDto
  ): Promise<DailySixEntity> {
    const entry = await this.repository.findOne({ where: { id } });

    if (!entry) {
      throw new RpcException('DailySix entry not found');
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
      throw new RpcException('DailySix entry not found');
    }

    if (entry.profileId !== profileId) {
      throw new RpcException('Not authorized to delete this entry');
    }

    await this.repository.remove(entry);
  }
}
