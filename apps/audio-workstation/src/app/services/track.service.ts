import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackEntity } from '../../entities/track.entity';
import { CreateTrackDto, UpdateTrackDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class TrackService {
  private readonly logger = new Logger(TrackService.name);

  constructor(
    @InjectRepository(TrackEntity)
    private readonly trackRepo: Repository<TrackEntity>
  ) {}

  async create(dto: CreateTrackDto): Promise<TrackEntity> {
    const track = this.trackRepo.create({
      projectId: dto.projectId,
      name: dto.name,
      type: dto.type,
      assetId: dto.assetId ?? null,
      volume: dto.volume ?? 0,
      pan: dto.pan ?? 0,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.trackRepo.save(track);
    this.logger.log(`Created track ${saved.id} in project ${dto.projectId}`);
    return saved;
  }

  async findByProject(projectId: string): Promise<TrackEntity[]> {
    return this.trackRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateTrackDto): Promise<TrackEntity> {
    const track = await this.trackRepo.findOne({ where: { id } });
    if (!track) {
      throw new RpcException({ status: 404, message: 'Track not found' });
    }
    Object.assign(track, dto);
    return this.trackRepo.save(track);
  }

  async delete(id: string): Promise<void> {
    const track = await this.trackRepo.findOne({ where: { id } });
    if (!track) {
      throw new RpcException({ status: 404, message: 'Track not found' });
    }
    await this.trackRepo.remove(track);
    this.logger.log(`Deleted track ${id}`);
  }
}
