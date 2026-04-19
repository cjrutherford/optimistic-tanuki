import { Inject, Injectable, Optional } from '@nestjs/common';
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
export class VideoProcessingService {
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
    },
  ) {}

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
          sourceAsset.storagePath,
        ),
      });

      const playbackAsset = await this.createFileAsset(
        sourceAsset.profileId,
        result.playbackPath,
        AssetType.VIDEO,
      );
      const segmentAssets = await Promise.all(
        result.hlsSegmentPaths.map((segmentPath) =>
          this.createFileAsset(sourceAsset.profileId, segmentPath, AssetType.VIDEO),
        ),
      );
      const manifestAsset = await this.createManifestAsset(
        sourceAsset.profileId,
        result,
        segmentAssets,
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
      this.assetsClient.send({ cmd: AssetCommands.RETRIEVE }, { id: assetId }),
    );
  }

  private async createFileAsset(
    profileId: string,
    filePath: string,
    type: AssetType,
  ): Promise<{ id: string }> {
    const fileName = path.basename(filePath);
    const fileBuffer = await fs.readFile(filePath);
    const extension = path.extname(fileName).slice(1);
    const asset = await firstValueFrom(
      this.assetsClient.send(
        { cmd: AssetCommands.CREATE },
        {
          name: fileName,
          profileId,
          type,
          content: fileBuffer.toString('base64'),
          fileExtension: extension,
        } satisfies CreateAssetDto,
      ),
    );

    return asset;
  }

  private async createManifestAsset(
    profileId: string,
    result: VideoTranscodeResult,
    segmentAssets: { id: string }[],
  ): Promise<{ id: string }> {
    const manifestPath = result.hlsManifestPath;
    const manifestName = path.basename(manifestPath);
    const rawManifest = await fs.readFile(manifestPath, 'utf8');
    const segmentMap = new Map<string, string>(
      result.hlsSegmentPaths.map((segmentPath, index) => [
        path.basename(segmentPath),
        segmentAssets[index]?.id || '',
      ]),
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
      this.assetsClient.send(
        { cmd: AssetCommands.CREATE },
        {
          name: manifestName,
          profileId,
          type: AssetType.VIDEO,
          content: Buffer.from(rewrittenManifest, 'utf8').toString('base64'),
          fileExtension: path.extname(manifestName).slice(1),
        } satisfies CreateAssetDto,
      ),
    );
  }
}
