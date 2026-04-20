import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoProcessingStatus,
  CompleteVideoProcessingResultDto,
} from '@optimistic-tanuki/models';
import { Video } from '../../entities/video.entity';
import { Channel } from '../../entities/channel.entity';
import { VideoProcessingService } from './video-processing.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly videoProcessingService?: VideoProcessingService,
  ) {}

  async create(createVideoDto: CreateVideoDto): Promise<Video> {
    const channel = await this.channelRepository.findOne({
      where: { id: createVideoDto.channelId },
    });
    const video = this.videoRepository.create({
      ...createVideoDto,
      sourceAssetId: createVideoDto.sourceAssetId ?? createVideoDto.assetId,
      processingStatus:
        createVideoDto.processingStatus ?? VideoProcessingStatus.PENDING,
      communityId: createVideoDto.communityId ?? channel?.communityId,
    });
    const savedVideo = await this.videoRepository.save(video);
    void this.videoProcessingService?.processVideo(savedVideo.id);
    return savedVideo;
  }

  async findAll(): Promise<Video[]> {
    return this.videoRepository.find({
      where: { visibility: 'public' },
      relations: ['channel'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Video> {
    return this.videoRepository.findOne({
      where: { id },
      relations: ['channel', 'views'],
    });
  }

  async findByChannel(channelId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { channelId },
      relations: ['channel'],
      order: { createdAt: 'DESC' },
    });
  }

  async findRecommended(limit = 20): Promise<Video[]> {
    // Basic recommendation: most viewed videos from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.videoRepository.find({
      where: {
        visibility: 'public',
        createdAt: MoreThan(thirtyDaysAgo),
      },
      relations: ['channel'],
      order: { viewCount: 'DESC', likeCount: 'DESC' },
      take: limit,
    });
  }

  async findTrending(limit = 20): Promise<Video[]> {
    // Trending: videos with high view count in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.videoRepository.find({
      where: {
        visibility: 'public',
        createdAt: MoreThan(sevenDaysAgo),
      },
      relations: ['channel'],
      order: { viewCount: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async update(id: string, updateVideoDto: UpdateVideoDto): Promise<Video> {
    const video = await this.findOne(id);
    if (!video) {
      throw new Error(`Video with ID ${id} not found`);
    }
    await this.videoRepository.update(id, {
      ...updateVideoDto,
      updatedAt: new Date(),
    });
    return this.findOne(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.videoRepository.increment({ id }, 'viewCount', 1);
  }

  async incrementLikeCount(id: string): Promise<void> {
    await this.videoRepository.increment({ id }, 'likeCount', 1);
  }

  async decrementLikeCount(id: string): Promise<void> {
    await this.videoRepository.decrement({ id }, 'likeCount', 1);
  }

  async remove(id: string): Promise<void> {
    await this.videoRepository.delete(id);
  }

  async markProcessing(id: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.videoRepository.update(id, {
      processingStatus: VideoProcessingStatus.PROCESSING,
      processingError: null,
      updatedAt: new Date(),
    });
  }

  async completeProcessing(
    id: string,
    result: CompleteVideoProcessingResultDto,
  ): Promise<void> {
    const video = await this.findOneOrFail(id);

    await this.videoRepository.update(id, {
      assetId: result.playbackAssetId,
      playbackAssetId: result.playbackAssetId,
      hlsManifestAssetId: result.hlsManifestAssetId,
      durationSeconds: result.durationSeconds ?? video.durationSeconds,
      resolution: result.resolution ?? video.resolution,
      encoding: result.encoding ?? video.encoding,
      processingStatus: result.processingStatus,
      processingError: null,
      updatedAt: new Date(),
    });
  }

  async failProcessing(id: string, error: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.videoRepository.update(id, {
      processingStatus: VideoProcessingStatus.FAILED,
      processingError: error,
      updatedAt: new Date(),
    });
  }

  private async findOneOrFail(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['channel', 'views'],
    });
    if (!video) {
      throw new Error(`Video with ID ${id} not found`);
    }
    return video;
  }
}
