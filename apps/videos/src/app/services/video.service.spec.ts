import { Repository } from 'typeorm';
import { VideoService } from './video.service';
import { Video } from '../../entities/video.entity';
import { Channel } from '../../entities/channel.entity';
import { VideoProcessingStatus } from '@optimistic-tanuki/models';

describe('VideoService processing lifecycle', () => {
  let videoRepository: jest.Mocked<Repository<Video>>;
  let channelRepository: jest.Mocked<Repository<Channel>>;
  let service: VideoService;

  beforeEach(() => {
    videoRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Video>>;
    channelRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Channel>>;

    service = new VideoService(videoRepository, channelRepository);
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
    ownerProfileId: string
  ): Video =>
    ({
      id: 'video-1',
      visibility,
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
});
