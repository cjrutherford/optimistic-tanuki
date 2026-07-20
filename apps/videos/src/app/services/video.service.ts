import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, And, IsNull, Not } from 'typeorm';
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
    private readonly videoProcessingService?: VideoProcessingService
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
    this.videoProcessingService?.enqueue(savedVideo.id);
    return savedVideo;
  }

  async findAll(): Promise<Video[]> {
    return this.videoRepository.find({
      where: this.publicReadyVideoWhere(),
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

  /**
   * Viewer-scoped single-video lookup for the public `GET videos/:id` route.
   *
   * `public` and `unlisted` videos are fetchable by anyone who has the id
   * (unlisted-by-direct-link is intentional). `private` videos are only
   * returned to their owner — the profile that owns the video's channel.
   * A private video requested by anyone else resolves to `null`, which the
   * gateway surfaces as a 404 so a private id is indistinguishable from a
   * non-existent one (no existence oracle).
   *
   * `viewerProfileId` MUST come from the gateway's signature-verified auth
   * context, never from an unverified token claim.
   */
  async findOneVisible(
    id: string,
    viewerProfileId?: string
  ): Promise<Video | null> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['channel', 'views'],
    });

    if (!video) {
      return null;
    }

    if (
      video.processingStatus !== VideoProcessingStatus.READY ||
      !video.playbackAssetId
    ) {
      return null;
    }

    if (
      video.visibility === 'private' &&
      (!viewerProfileId || video.channel?.profileId !== viewerProfileId)
    ) {
      return null;
    }

    return video;
  }

  async findByChannel(channelId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { ...this.publicReadyVideoWhere(), channelId },
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
        ...this.publicReadyVideoWhere(),
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
        ...this.publicReadyVideoWhere(),
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

  private publicReadyVideoWhere() {
    return {
      visibility: 'public' as const,
      processingStatus: VideoProcessingStatus.READY,
      playbackAssetId: And(Not(IsNull()), Not('')),
    };
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

  async retryProcessing(id: string): Promise<void> {
    const video = await this.findOneOrFail(id);

    await this.videoRepository.update(id, {
      processingStatus: VideoProcessingStatus.PENDING,
      processingError: null,
      updatedAt: new Date(),
    });
    this.videoProcessingService?.enqueue(video.id);
  }

  async getProcessingOverview(): Promise<{
    totals: Record<VideoProcessingStatus, number>;
    queue: {
      activeJobs: number;
      queuedJobs: number;
      maxConcurrentJobs: number;
    };
    jobs: Array<{
      id: string;
      title: string;
      processingStatus: VideoProcessingStatus;
      processingError: string | null;
      updatedAt: Date;
    }>;
  }> {
    const videos = await this.videoRepository.find({
      order: { updatedAt: 'DESC' },
    });
    const totals: Record<VideoProcessingStatus, number> = {
      [VideoProcessingStatus.PENDING]: 0,
      [VideoProcessingStatus.PROCESSING]: 0,
      [VideoProcessingStatus.READY]: 0,
      [VideoProcessingStatus.FAILED]: 0,
    };

    for (const video of videos) {
      totals[video.processingStatus as VideoProcessingStatus] += 1;
    }

    return {
      totals,
      queue: this.videoProcessingService?.getQueueMetrics() ?? {
        activeJobs: 0,
        queuedJobs: 0,
        maxConcurrentJobs: 0,
      },
      jobs: videos.slice(0, 50).map((video) => ({
        id: video.id,
        title: video.title,
        processingStatus: video.processingStatus as VideoProcessingStatus,
        processingError: video.processingError,
        updatedAt: video.updatedAt,
      })),
    };
  }

  async retryFailedProcessing(): Promise<{ queued: number }> {
    const failedVideos = await this.videoRepository.find({
      where: { processingStatus: VideoProcessingStatus.FAILED },
      order: { updatedAt: 'ASC' },
    });

    for (const video of failedVideos) {
      await this.retryProcessing(video.id);
    }

    return { queued: failedVideos.length };
  }

  async completeProcessing(
    id: string,
    result: CompleteVideoProcessingResultDto
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
