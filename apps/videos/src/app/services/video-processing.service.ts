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
import { VideoDeletionProcessingFenceService } from './video-deletion-processing-fence.service';

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
  @Inject(VideoDeletionProcessingFenceService)
  private readonly deletionFence!: VideoDeletionProcessingFenceService;
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
      void this.processVideo(videoId)
        .catch(() => undefined)
        .finally(() => {
          this.activeJobs -= 1;
          this.queuedVideoIds.delete(videoId);
          this.drainQueue();
        });
    }
  }

  async processVideo(videoId: string): Promise<void> {
    await this.deletionFence.run(videoId, (profileId) =>
      this.processAdmittedVideo(videoId, profileId)
    );
  }

  private async processAdmittedVideo(
    videoId: string,
    profileId: string
  ): Promise<void> {
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
      if (sourceAsset.profileId !== profileId)
        throw new Error('VIDEO_SOURCE_PROFILE_BINDING_INVALID');
      const result = await this.transcodeClient.transcode({
        videoId,
        sourcePath: path.join(
          this.config.assetStorageRoot,
          sourceAsset.storagePath
        ),
      });

      const playbackAsset = await this.createFileAsset(
        videoId,
        sourceAsset.profileId,
        result.playbackPath,
        AssetType.VIDEO
      );
      const segmentAssets = await Promise.all(
        result.hlsSegmentPaths.map((segmentPath) =>
          this.createFileAsset(
            videoId,
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
    videoId: string,
    profileId: string,
    filePath: string,
    type: AssetType
  ): Promise<{ id: string }> {
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName).slice(1);
    const stagedSourcePath = await this.stageFileForAssetImport(
      videoId,
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
    videoId: string,
    filePath: string,
    fileName: string
  ): Promise<string> {
    const parent = this.importDirectory(videoId);
    await fs.mkdir(parent, { recursive: true, mode: 0o700 });
    await this.assertImportDirectory(parent);
    const stagingDir = await fs.mkdtemp(path.join(parent, 'attempt-'));
    const stagedPath = path.join(stagingDir, fileName);
    await fs.copyFile(filePath, stagedPath);
    return stagedPath;
  }

  private importDirectory(videoId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        videoId
      )
    )
      throw new Error('VIDEO_IMPORT_ID_INVALID');
    return path.join(
      path.resolve(this.config.assetStorageRoot),
      '.video-processing-imports',
      videoId
    );
  }

  private async assertImportDirectory(directory: string): Promise<void> {
    for (const current of [
      path.resolve(this.config.assetStorageRoot),
      path.dirname(directory),
      directory,
    ]) {
      const info = await fs.lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error('VIDEO_IMPORT_CUSTODY_INVALID');
    }
  }

  /** Called only after the owner has drained processing and validated its fixed scope. */
  async purgeDeletionStaging(videoIds: readonly string[]): Promise<void> {
    if (videoIds.length > 10000) throw new Error('VIDEO_IMPORT_BOUND_EXCEEDED');
    let root;
    try {
      root = await fs.opendir(this.config.assetStorageRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    let entries = 0;
    for await (const entry of root) {
      if (++entries > 10000) throw new Error('VIDEO_IMPORT_BOUND_EXCEEDED');
      if (entry.name.startsWith('video-processing-import-'))
        throw new Error('VIDEO_LEGACY_IMPORT_ATTRIBUTION_UNRESOLVED');
    }
    for (const id of videoIds) {
      const directory = this.importDirectory(id);
      try {
        await this.assertImportDirectory(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      let count = 0;
      const validate = async (
        current: string,
        depth: number
      ): Promise<void> => {
        if (depth > 3) throw new Error('VIDEO_IMPORT_BOUND_EXCEEDED');
        const dir = await fs.opendir(current);
        for await (const entry of dir) {
          if (++count > 1000) throw new Error('VIDEO_IMPORT_BOUND_EXCEEDED');
          const file = path.join(current, entry.name),
            info = await fs.lstat(file);
          if (info.isSymbolicLink())
            throw new Error('VIDEO_IMPORT_CUSTODY_INVALID');
          if (info.isDirectory()) await validate(file, depth + 1);
          else if (!info.isFile() || info.nlink !== 1)
            throw new Error('VIDEO_IMPORT_CUSTODY_INVALID');
        }
      };
      await validate(directory, 0);
      await fs.rm(directory, { recursive: true });
      try {
        await fs.lstat(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      throw new Error('VIDEO_IMPORT_ABSENCE_UNVERIFIED');
    }
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
