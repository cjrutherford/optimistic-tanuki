import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordVideoViewDto } from '@optimistic-tanuki/models';
import { VideoView } from '../../entities/video-view.entity';

@Injectable()
export class VideoViewService {
  constructor(
    @InjectRepository(VideoView)
    private readonly videoViewRepository: Repository<VideoView>
  ) {}

  async recordView(
    recordViewDto: RecordVideoViewDto,
    ipAddress?: string
  ): Promise<VideoView> {
    const view = this.videoViewRepository.create({
      ...recordViewDto,
      ipAddress,
    });
    return this.videoViewRepository.save(view);
  }

  async findVideoViews(videoId: string): Promise<VideoView[]> {
    return this.videoViewRepository.find({
      where: { videoId },
      order: { viewedAt: 'DESC' },
    });
  }

  async getVideoViewCount(videoId: string): Promise<number> {
    return this.videoViewRepository.count({
      where: { videoId },
    });
  }
}
