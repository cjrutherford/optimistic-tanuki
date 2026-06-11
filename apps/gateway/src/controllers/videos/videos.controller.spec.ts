import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ServiceTokens, VideoCommands } from '@optimistic-tanuki/constants';
import { VideosController } from './videos.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { VideoProcessingStatus } from '@optimistic-tanuki/models';
import { ProfileTelosRefreshService } from '../../app/profile-telos-refresh.service';

describe('VideosController', () => {
  let controller: VideosController;
  let videosService: jest.Mocked<ClientProxy>;
  let telosRefresh: { queueSourceRefresh: jest.Mock };

  beforeEach(async () => {
    videosService = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    telosRefresh = {
      queueSourceRefresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [
        {
          provide: ServiceTokens.VIDEOS_SERVICE,
          useValue: videosService,
        },
        {
          provide: ProfileTelosRefreshService,
          useValue: telosRefresh,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<VideosController>(VideosController);
  });

  it('sends a defined payload for recommended videos when limit is omitted', async () => {
    await expect(controller.findRecommendedVideos(undefined)).resolves.toEqual(
      []
    );

    expect(videosService.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.FIND_RECOMMENDED_VIDEOS },
      {}
    );
  });

  it('sends a defined payload for trending videos when limit is omitted', async () => {
    await expect(controller.findTrendingVideos(undefined)).resolves.toEqual([]);

    expect(videosService.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.FIND_TRENDING_VIDEOS },
      {}
    );
  });

  it('forwards provided recommended limit values', async () => {
    await expect(controller.findRecommendedVideos(10 as any)).resolves.toEqual(
      []
    );

    expect(videosService.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.FIND_RECOMMENDED_VIDEOS },
      10
    );
  });

  it('forwards provided trending limit values', async () => {
    await expect(controller.findTrendingVideos(10 as any)).resolves.toEqual([]);

    expect(videosService.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.FIND_TRENDING_VIDEOS },
      10
    );
  });

  it('forwards processing-complete updates for internal worker callbacks', async () => {
    await expect(
      controller.completeVideoProcessing('video-1', {
        playbackAssetId: 'asset-mp4',
        hlsManifestAssetId: 'asset-hls',
        durationSeconds: 90,
        resolution: '1280x720',
        encoding: 'h264+aac',
      } as any)
    ).resolves.toEqual([]);

    expect(videosService.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.COMPLETE_VIDEO_PROCESSING },
      {
        id: 'video-1',
        result: {
          playbackAssetId: 'asset-mp4',
          hlsManifestAssetId: 'asset-hls',
          durationSeconds: 90,
          resolution: '1280x720',
          encoding: 'h264+aac',
          processingStatus: VideoProcessingStatus.READY,
        },
      }
    );
  });

  it('queues a TELOS refresh after creating a channel', async () => {
    videosService.send.mockReturnValueOnce(
      of({
        id: 'channel-1',
        profileId: 'profile-1',
      })
    );

    const result = await controller.createChannel({
      name: 'Builder Broadcast',
      profileId: 'profile-1',
      userId: '00000000-0000-0000-0000-000000000001',
    } as any);

    expect(result).toEqual({
      id: 'channel-1',
      profileId: 'profile-1',
    });
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        namespaceKey: 'videos',
      })
    );
  });

  it('queues a TELOS refresh after creating a video by resolving the owning channel', async () => {
    videosService.send
      .mockReturnValueOnce(
        of({
          id: 'video-1',
          channelId: 'channel-1',
        })
      )
      .mockReturnValueOnce(
        of({
          id: 'channel-1',
          profileId: 'profile-1',
        })
      );

    await controller.createVideo({
      title: 'Systems Design Patterns',
      assetId: '00000000-0000-0000-0000-000000000010',
      channelId: 'channel-1',
    } as any);

    expect(videosService.send).toHaveBeenNthCalledWith(
      2,
      { cmd: VideoCommands.FIND_ONE_CHANNEL },
      'channel-1'
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        namespaceKey: 'videos',
      })
    );
  });
});
