import { And, IsNull, Not, Repository } from 'typeorm';
import { VideoService } from './video.service';
import { Video } from '../../entities/video.entity';
import { Channel } from '../../entities/channel.entity';
import { VideoProcessingStatus } from '@optimistic-tanuki/models';

describe('VideoService processing lifecycle', () => {
  let videoRepository: jest.Mocked<Repository<Video>>;
  let channelRepository: jest.Mocked<Repository<Channel>>;
  let processingService: {
    enqueue: jest.Mock;
    getQueueMetrics: jest.Mock;
  };
  let service: VideoService;

  beforeEach(() => {
    videoRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Video>>;
    channelRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Channel>>;
    processingService = {
      enqueue: jest.fn(),
      getQueueMetrics: jest.fn().mockReturnValue({
        activeJobs: 1,
        queuedJobs: 2,
        maxConcurrentJobs: 2,
      }),
    };

    service = new VideoService(
      videoRepository,
      channelRepository,
      processingService as never
    );
  });

  it('creates uploaded videos in pending status with the source asset retained', async () => {
    channelRepository.findOne.mockResolvedValue({
      id: 'channel-1',
      communityId: 'community-1',
    } as Channel);
    videoRepository.create.mockImplementation((value) => value as Video);
    videoRepository.save.mockImplementation(async (value) => value as Video);

    const result = await service.create({
      title: 'Upload',
      assetId: 'source-asset',
      channelId: 'channel-1',
    });

    expect(videoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'source-asset',
        sourceAssetId: 'source-asset',
        processingStatus: VideoProcessingStatus.PENDING,
        communityId: 'community-1',
      })
    );
    expect(result.processingStatus).toBe(VideoProcessingStatus.PENDING);
    expect(processingService.enqueue).toHaveBeenCalledWith(result.id);
  });

  it('queues a failed video for retry and clears its previous error', async () => {
    videoRepository.findOne.mockResolvedValue({
      id: 'video-1',
      processingStatus: VideoProcessingStatus.FAILED,
    } as Video);

    await service.retryProcessing('video-1');

    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({
        processingStatus: VideoProcessingStatus.PENDING,
        processingError: null,
      })
    );
    expect(processingService.enqueue).toHaveBeenCalledWith('video-1');
  });

  it('summarizes processing jobs for operators', async () => {
    videoRepository.find.mockResolvedValue([
      {
        id: 'ready-1',
        title: 'Ready clip',
        processingStatus: VideoProcessingStatus.READY,
        updatedAt: new Date('2026-07-20T10:00:00Z'),
      },
      {
        id: 'processing-1',
        title: 'Encoding clip',
        processingStatus: VideoProcessingStatus.PROCESSING,
        updatedAt: new Date('2026-07-20T11:00:00Z'),
      },
      {
        id: 'failed-1',
        title: 'Broken clip',
        processingStatus: VideoProcessingStatus.FAILED,
        processingError: 'ffmpeg exited 1',
        updatedAt: new Date('2026-07-20T12:00:00Z'),
      },
    ] as Video[]);

    await expect(service.getProcessingOverview()).resolves.toEqual(
      expect.objectContaining({
        totals: expect.objectContaining({ ready: 1, processing: 1, failed: 1 }),
        queue: { activeJobs: 1, queuedJobs: 2, maxConcurrentJobs: 2 },
        jobs: expect.arrayContaining([
          expect.objectContaining({
            id: 'failed-1',
            processingError: 'ffmpeg exited 1',
          }),
        ]),
      })
    );
  });

  it('marks a video as ready with normalized playback assets', async () => {
    videoRepository.findOne.mockResolvedValue({
      id: 'video-1',
      assetId: 'source-asset',
    } as Video);
    videoRepository.update.mockResolvedValue({} as never);

    await service.completeProcessing('video-1', {
      playbackAssetId: 'playback-asset',
      hlsManifestAssetId: 'manifest-asset',
      durationSeconds: 123,
      resolution: '1920x1080',
      encoding: 'h264+aac',
      processingStatus: VideoProcessingStatus.READY,
    });

    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({
        assetId: 'playback-asset',
        playbackAssetId: 'playback-asset',
        hlsManifestAssetId: 'manifest-asset',
        processingStatus: VideoProcessingStatus.READY,
      })
    );
  });

  it('stores processing errors on failure', async () => {
    videoRepository.findOne.mockResolvedValue({
      id: 'video-1',
      assetId: 'source-asset',
    } as Video);
    videoRepository.update.mockResolvedValue({} as never);

    await service.failProcessing('video-1', 'transcoder crashed');

    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({
        processingStatus: VideoProcessingStatus.FAILED,
        processingError: 'transcoder crashed',
      })
    );
  });
});

describe('VideoService.findOneVisible visibility scoping', () => {
  let videoRepository: jest.Mocked<Repository<Video>>;
  let channelRepository: jest.Mocked<Repository<Channel>>;
  let service: VideoService;

  const videoWith = (
    visibility: Video['visibility'],
    ownerProfileId: string,
    processingStatus: VideoProcessingStatus = VideoProcessingStatus.READY,
    playbackAssetId = 'playback-asset'
  ): Video =>
    ({
      id: 'video-1',
      visibility,
      processingStatus,
      playbackAssetId,
      channel: { id: 'channel-1', profileId: ownerProfileId } as Channel,
    } as Video);

  beforeEach(() => {
    videoRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Video>>;
    channelRepository = {} as unknown as jest.Mocked<Repository<Channel>>;
    service = new VideoService(videoRepository, channelRepository);
  });

  it('returns a public video to an anonymous viewer', async () => {
    videoRepository.findOne.mockResolvedValue(videoWith('public', 'owner-1'));
    expect(await service.findOneVisible('video-1')).not.toBeNull();
  });

  it('returns an unlisted video to anyone with the id (by-link access)', async () => {
    videoRepository.findOne.mockResolvedValue(videoWith('unlisted', 'owner-1'));
    expect(
      await service.findOneVisible('video-1', 'someone-else')
    ).not.toBeNull();
  });

  it('hides a private video from an anonymous viewer', async () => {
    videoRepository.findOne.mockResolvedValue(videoWith('private', 'owner-1'));
    expect(await service.findOneVisible('video-1')).toBeNull();
  });

  it('hides a private video from a non-owner', async () => {
    videoRepository.findOne.mockResolvedValue(videoWith('private', 'owner-1'));
    expect(await service.findOneVisible('video-1', 'attacker-2')).toBeNull();
  });

  it('returns a private video to its owner', async () => {
    videoRepository.findOne.mockResolvedValue(videoWith('private', 'owner-1'));
    expect(await service.findOneVisible('video-1', 'owner-1')).not.toBeNull();
  });

  it('returns null for a missing video', async () => {
    videoRepository.findOne.mockResolvedValue(null);
    expect(await service.findOneVisible('missing', 'owner-1')).toBeNull();
  });

  it.each([
    VideoProcessingStatus.PENDING,
    VideoProcessingStatus.PROCESSING,
    VideoProcessingStatus.FAILED,
  ])('hides a %s video before applying visibility rules', async (status) => {
    videoRepository.findOne.mockResolvedValue(
      videoWith('private', 'owner-1', status)
    );

    expect(await service.findOneVisible('video-1', 'owner-1')).toBeNull();
  });

  it('hides a public video until its processing reaches ready', async () => {
    videoRepository.findOne.mockResolvedValue(
      videoWith('public', 'owner-1', VideoProcessingStatus.PROCESSING)
    );

    expect(await service.findOneVisible('video-1')).toBeNull();
  });

  it('hides a ready video that has no processed playback asset', async () => {
    videoRepository.findOne.mockResolvedValue(
      videoWith('public', 'owner-1', VideoProcessingStatus.READY, null)
    );

    expect(await service.findOneVisible('video-1')).toBeNull();
  });
});

describe('VideoService public list readiness scoping', () => {
  let videoRepository: jest.Mocked<Repository<Video>>;
  let service: VideoService;
  const processedPlaybackAsset = And(Not(IsNull()), Not(''));

  beforeEach(() => {
    videoRepository = { find: jest.fn() } as unknown as jest.Mocked<
      Repository<Video>
    >;
    service = new VideoService(videoRepository, {} as Repository<Channel>);
  });

  it('limits the public feed to ready videos with a processed playback asset', async () => {
    await service.findAll();

    expect(videoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: 'public',
          processingStatus: VideoProcessingStatus.READY,
          playbackAssetId: processedPlaybackAsset,
        }),
      })
    );
  });

  it('limits channel videos to public ready videos with a processed playback asset', async () => {
    await service.findByChannel('channel-1');

    expect(videoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channelId: 'channel-1',
          visibility: 'public',
          processingStatus: VideoProcessingStatus.READY,
          playbackAssetId: processedPlaybackAsset,
        }),
      })
    );
  });

  it('limits recommendations to public ready videos with a processed playback asset', async () => {
    await service.findRecommended();

    expect(videoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: 'public',
          processingStatus: VideoProcessingStatus.READY,
          playbackAssetId: processedPlaybackAsset,
          createdAt: expect.anything(),
        }),
      })
    );
  });

  it('limits trending videos to public ready videos with a processed playback asset', async () => {
    await service.findTrending();

    expect(videoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: 'public',
          processingStatus: VideoProcessingStatus.READY,
          playbackAssetId: processedPlaybackAsset,
          createdAt: expect.anything(),
        }),
      })
    );
  });
});
