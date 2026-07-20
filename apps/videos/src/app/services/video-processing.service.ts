import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  AssetType,
  CreateAssetDto,
  VideoProcessingStatus,
} from '@optimistic-tanuki/models';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { Video } from '../../entities/video.entity';
import {
  VideoTranscodeClientService,
  VideoTranscodeResult,
} from './video-transcode-client.service';

type AssetRecord = {
  id: string;
  name: string;
  profileId: string;
  storagePath: string;
};

type ProcessingConfig = {
  assetStorageRoot: string;
};

export const VIDEO_PROCESSING_CONFIG = 'VIDEO_PROCESSING_CONFIG';

@Injectable()
export class VideoProcessingService implements OnApplicationBootstrap {
  private readonly queuedVideoIds = new Set<string>();
  private readonly queue: string[] = [];
  private activeJobs = 0;
  private readonly maxConcurrentJobs = Math.max(
    1,
    Number.parseInt(process.env['VIDEO_PROCESSING_CONCURRENCY'] || '2', 10) || 2
  );
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetsClient: ClientProxy,
    private readonly transcodeClient: VideoTranscodeClientService,
    @Optional()
    @Inject(VIDEO_PROCESSING_CONFIG)
    private readonly config: ProcessingConfig = {
      assetStorageRoot:
        process.env['LOCAL_STORAGE_PATH'] || '/usr/src/app/storage',
    }
  ) {}

  /**
   * Resume work that was in-memory when this service last stopped. The queue
   * enforces the normal concurrency limit, so a restart cannot flood the
   * transcoder with every pending upload at once.
   */
  async onApplicationBootstrap(): Promise<void> {
    const recoverableVideos = await this.videoRepository.find({
      where: [
        { processingStatus: VideoProcessingStatus.PENDING },
        { processingStatus: VideoProcessingStatus.PROCESSING },
      ],
      order: { updatedAt: 'ASC' },
    });

    for (const video of recoverableVideos) {
      this.enqueue(video.id);
    }
  }

  getQueueMetrics(): {
    activeJobs: number;
    queuedJobs: number;
    maxConcurrentJobs: number;
  } {
    return {
      activeJobs: this.activeJobs,
      queuedJobs: this.queue.length,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };
  }

  enqueue(videoId: string): void {
    if (this.queuedVideoIds.has(videoId)) {
      return;
    }

    this.queuedVideoIds.add(videoId);
    this.queue.push(videoId);
    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.activeJobs < this.maxConcurrentJobs && this.queue.length > 0) {
      const videoId = this.queue.shift();
      if (!videoId) {
        continue;
      }

      this.activeJobs += 1;
      void this.processVideo(videoId).finally(() => {
        this.activeJobs -= 1;
        this.queuedVideoIds.delete(videoId);
        this.drainQueue();
      });
    }
  }

  async processVideo(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      return;
    }

    const sourceAssetId = video.sourceAssetId || video.assetId;

    try {
      await this.videoRepository.update(videoId, {
        processingStatus: VideoProcessingStatus.PROCESSING,
        processingError: null,
        updatedAt: new Date(),
      });

      const sourceAsset = await this.retrieveAsset(sourceAssetId);
      const result = await this.transcodeClient.transcode({
        videoId,
        sourcePath: path.join(
          this.config.assetStorageRoot,
          sourceAsset.storagePath
        ),
      });

      const playbackAsset = await this.createFileAsset(
        sourceAsset.profileId,
        result.playbackPath,
        AssetType.VIDEO
      );
      const segmentAssets = await Promise.all(
        result.hlsSegmentPaths.map((segmentPath) =>
          this.createFileAsset(
            sourceAsset.profileId,
            segmentPath,
            AssetType.VIDEO
          )
        )
      );
      const manifestAsset = await this.createManifestAsset(
        sourceAsset.profileId,
        result,
        segmentAssets
      );

      await this.videoRepository.update(videoId, {
        assetId: playbackAsset.id,
        playbackAssetId: playbackAsset.id,
        hlsManifestAssetId: manifestAsset.id,
        durationSeconds: result.durationSeconds ?? video.durationSeconds,
        resolution: result.resolution ?? video.resolution,
        encoding: result.encoding ?? video.encoding,
        processingStatus: VideoProcessingStatus.READY,
        processingError: null,
        updatedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.videoRepository.update(videoId, {
        processingStatus: VideoProcessingStatus.FAILED,
        processingError: message,
        updatedAt: new Date(),
      });
    }
  }

  private async retrieveAsset(assetId: string): Promise<AssetRecord> {
    return firstValueFrom(
      this.assetsClient.send({ cmd: AssetCommands.RETRIEVE }, { id: assetId })
    );
  }

  private async createFileAsset(
    profileId: string,
    filePath: string,
    type: AssetType
  ): Promise<{ id: string }> {
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName).slice(1);
    const stagedSourcePath = await this.stageFileForAssetImport(
      filePath,
      fileName
    );

    try {
      const asset = await firstValueFrom(
        this.assetsClient.send({ cmd: AssetCommands.CREATE }, {
          name: fileName,
          profileId,
          type,
          sourcePath: stagedSourcePath,
          fileExtension: extension,
        } satisfies CreateAssetDto)
      );

      return asset;
    } finally {
      await fs.rm(path.dirname(stagedSourcePath), {
        recursive: true,
        force: true,
      });
    }
  }

  private async stageFileForAssetImport(
    filePath: string,
    fileName: string
  ): Promise<string> {
    await fs.mkdir(this.config.assetStorageRoot, { recursive: true });
    const stagingDir = await fs.mkdtemp(
      path.join(this.config.assetStorageRoot, 'video-processing-import-')
    );
    const stagedPath = path.join(stagingDir, fileName);
    await fs.copyFile(filePath, stagedPath);
    return stagedPath;
  }

  private async createManifestAsset(
    profileId: string,
    result: VideoTranscodeResult,
    segmentAssets: { id: string }[]
  ): Promise<{ id: string }> {
    const manifestPath = result.hlsManifestPath;
    const manifestName = path.basename(manifestPath);
    const rawManifest = await fs.readFile(manifestPath, 'utf8');
    const segmentMap = new Map<string, string>(
      result.hlsSegmentPaths.map((segmentPath, index) => [
        path.basename(segmentPath),
        segmentAssets[index]?.id || '',
      ])
    );
    const rewrittenManifest = rawManifest
      .split('\n')
      .map((line) => {
        if (!line || line.startsWith('#')) {
          return line;
        }

        const assetId = segmentMap.get(line.trim());
        return assetId ? `/api/asset/${assetId}` : line;
      })
      .join('\n');

    return firstValueFrom(
      this.assetsClient.send({ cmd: AssetCommands.CREATE }, {
        name: manifestName,
        profileId,
        type: AssetType.VIDEO,
        content: Buffer.from(rewrittenManifest, 'utf8').toString('base64'),
        fileExtension: path.extname(manifestName).slice(1),
      } satisfies CreateAssetDto)
    );
  }
}
