import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { VideoProcessingService } from './video-processing.service';
import { Video } from '../../entities/video.entity';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('VideoProcessingService', () => {
  const createService = (assetStorageRoot = '/asset-root') => {
    const videoRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Video>>;
    const assetsClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const transcodeClient = {
      transcode: jest.fn(),
    };

    const service = new VideoProcessingService(
      videoRepository,
      assetsClient,
      transcodeClient as never,
      {
        assetStorageRoot,
      },
    );

    return { service, videoRepository, assetsClient, transcodeClient };
  };

  it('transcodes a source asset and persists mp4 plus hls playback assets', async () => {
    const workingDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'video-processing-spec-'),
    );
    const assetStorageRoot = path.join(workingDir, 'asset-storage');
    const playbackPath = path.join(workingDir, 'playback.mp4');
    const manifestPath = path.join(workingDir, 'stream.m3u8');
    const segmentPath = path.join(workingDir, 'segment-000.ts');
    const { service, videoRepository, assetsClient, transcodeClient } =
      createService(assetStorageRoot);

    await fs.mkdir(assetStorageRoot, { recursive: true });
    await fs.writeFile(playbackPath, Buffer.from('mp4'));
    await fs.writeFile(
      manifestPath,
      '#EXTM3U\n#EXTINF:6.0,\nsegment-000.ts\n#EXT-X-ENDLIST\n',
    );
    await fs.writeFile(segmentPath, Buffer.from('ts'));

    videoRepository.findOne.mockResolvedValue({
      id: 'video-1',
      title: 'Demo',
      assetId: 'source-asset',
      sourceAssetId: 'source-asset',
    } as Video);
    assetsClient.send.mockImplementation((pattern: { cmd: string }, payload) => {
      if (pattern.cmd === AssetCommands.RETRIEVE) {
        return of({
          id: 'source-asset',
          name: 'upload.mkv',
          profileId: 'profile-1',
          storagePath: 'assets/source-asset/upload.mkv',
        });
      }

      if (pattern.cmd === AssetCommands.CREATE) {
        return of({
          id: `created-${(payload as { name: string }).name}`,
        });
      }

      throw new Error(`Unexpected asset command ${pattern.cmd}`);
    });
    transcodeClient.transcode.mockResolvedValue({
      playbackPath,
      hlsManifestPath: manifestPath,
      hlsSegmentPaths: [segmentPath],
      durationSeconds: 95,
      resolution: '1920x1080',
      encoding: 'h264+aac',
    });

    await service.processVideo('video-1');

    expect(transcodeClient.transcode).toHaveBeenCalledWith({
      videoId: 'video-1',
      sourcePath: path.join(
        assetStorageRoot,
        'assets/source-asset/upload.mkv',
      ),
    });
    expect(assetsClient.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.objectContaining({
        name: 'playback.mp4',
        type: 'video',
        sourcePath: expect.stringMatching(
          new RegExp(
            `^${assetStorageRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          ),
        ),
      }),
    );
    expect(assetsClient.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.not.objectContaining({
        name: 'playback.mp4',
        content: expect.any(String),
      }),
    );
    expect(assetsClient.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.objectContaining({
        name: 'stream.m3u8',
        type: 'video',
      }),
    );
    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({
        assetId: 'created-playback.mp4',
        playbackAssetId: 'created-playback.mp4',
        hlsManifestAssetId: 'created-stream.m3u8',
        processingStatus: 'ready',
      }),
    );
  });

  it('marks the video as failed when the worker errors', async () => {
    const { service, videoRepository, assetsClient, transcodeClient } =
      createService();

    videoRepository.findOne.mockResolvedValue({
      id: 'video-1',
      assetId: 'source-asset',
      sourceAssetId: 'source-asset',
    } as Video);
    assetsClient.send.mockReturnValue(
      of({
        id: 'source-asset',
        name: 'upload.mov',
        profileId: 'profile-1',
        storagePath: 'assets/source-asset/upload.mov',
      }),
    );
    transcodeClient.transcode.mockRejectedValue(new Error('ffmpeg failed'));

    await service.processVideo('video-1');

    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({
        processingStatus: 'failed',
        processingError: 'ffmpeg failed',
      }),
    );
  });
});
