import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MixSnapshotEntity } from '../../entities/mix-snapshot.entity';
import { SaveMixDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class MixService {
  private readonly logger = new Logger(MixService.name);

  constructor(
    @InjectRepository(MixSnapshotEntity)
    private readonly mixRepo: Repository<MixSnapshotEntity>
  ) {}

  async save(userId: string, dto: SaveMixDto): Promise<MixSnapshotEntity> {
    let snapshot = await this.mixRepo.findOne({
      where: { projectId: dto.projectId, trackId: dto.trackId },
    });

    if (snapshot) {
      Object.assign(snapshot, dto);
    } else {
      snapshot = this.mixRepo.create({
        projectId: dto.projectId,
        trackId: dto.trackId,
        volume: dto.volume,
        pan: dto.pan,
        eq: dto.eq || {},
        dynamics: dto.dynamics || {},
        effects: dto.effects || {},
      });
    }

    const saved = await this.mixRepo.save(snapshot);
    this.logger.log(`Saved mix snapshot for track ${dto.trackId}`);
    return saved;
  }

  async findByProject(projectId: string): Promise<MixSnapshotEntity[]> {
    return this.mixRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByTrack(
    projectId: string,
    trackId: string
  ): Promise<MixSnapshotEntity> {
    const snapshot = await this.mixRepo.findOne({
      where: { projectId, trackId },
    });
    if (!snapshot) {
      throw new RpcException({
        status: 404,
        message: 'Mix snapshot not found',
      });
    }
    return snapshot;
  }
}
