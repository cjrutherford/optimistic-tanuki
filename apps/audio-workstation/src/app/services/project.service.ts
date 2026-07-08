import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { AudioProjectEntity } from '../../entities/audio-project.entity';
import { TrackEntity } from '../../entities/track.entity';
import {
  CreateAudioProjectDto,
  UpdateAudioProjectDto,
} from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(AudioProjectEntity)
    private readonly projectRepo: Repository<AudioProjectEntity>,
    @InjectRepository(TrackEntity)
    private readonly trackRepo: Repository<TrackEntity>
  ) {}

  async create(
    userId: string,
    dto: CreateAudioProjectDto
  ): Promise<AudioProjectEntity> {
    const project = this.projectRepo.create({
      userId,
      name: dto.name,
      bpm: dto.bpm ?? 120,
      key: dto.key ?? 'C',
      timeSignature: dto.timeSignature ?? '4/4',
      genre: dto.genre ?? null,
      mood: dto.mood ?? null,
    });
    const saved = await this.projectRepo.save(project);
    this.logger.log(`Created project ${saved.id} for user ${userId}`);
    return saved;
  }

  async findById(id: string, userId: string): Promise<AudioProjectEntity> {
    const project = await this.projectRepo.findOne({
      where: { id, userId },
      relations: ['tracks', 'arrangement', 'mixSnapshots'],
    });
    if (!project) {
      throw new RpcException({ status: 404, message: 'Project not found' });
    }
    return project;
  }

  async findByUser(userId: string): Promise<AudioProjectEntity[]> {
    return this.projectRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAudioProjectDto
  ): Promise<AudioProjectEntity> {
    const project = await this.findById(id, userId);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async delete(id: string, userId: string): Promise<void> {
    const project = await this.findById(id, userId);
    await this.projectRepo.remove(project);
    this.logger.log(`Deleted project ${id}`);
  }
}
