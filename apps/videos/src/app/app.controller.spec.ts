import { AppController } from './app.controller';
import { VideoProcessingStatus } from '@optimistic-tanuki/models';

describe('AppController video limit handling', () => {
  const createController = () => {
    const videoService = {
      findRecommended: jest.fn(),
      findTrending: jest.fn(),
      markProcessing: jest.fn(),
      completeProcessing: jest.fn(),
      failProcessing: jest.fn(),
    };

    const controller = new AppController(
      {} as never,
      videoService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { controller, videoService };
  };

  it('passes undefined to recommended videos when payload is empty', async () => {
    const { controller, videoService } = createController();

    await controller.findRecommendedVideos({} as never);

    expect(videoService.findRecommended).toHaveBeenCalledWith(undefined);
  });

  it('parses string payloads for recommended videos', async () => {
    const { controller, videoService } = createController();

    await controller.findRecommendedVideos('10' as never);

    expect(videoService.findRecommended).toHaveBeenCalledWith(10);
  });

  it('passes undefined to trending videos when payload is empty', async () => {
    const { controller, videoService } = createController();

    await controller.findTrendingVideos({} as never);

    expect(videoService.findTrending).toHaveBeenCalledWith(undefined);
  });

  it('parses string payloads for trending videos', async () => {
    const { controller, videoService } = createController();

    await controller.findTrendingVideos('10' as never);

    expect(videoService.findTrending).toHaveBeenCalledWith(10);
  });

  it('marks a video as processing', async () => {
    const { controller, videoService } = createController();

    await controller.markVideoProcessing('video-1');

    expect(videoService.markProcessing).toHaveBeenCalledWith('video-1');
  });

  it('completes video processing with normalized playback fields', async () => {
    const { controller, videoService } = createController();
    const payload = {
      id: 'video-1',
      result: {
        playbackAssetId: 'asset-mp4',
        hlsManifestAssetId: 'asset-hls',
        durationSeconds: 321,
        resolution: '1920x1080',
        encoding: 'h264+aac',
      },
    };

    await controller.completeVideoProcessing(payload as never);

    expect(videoService.completeProcessing).toHaveBeenCalledWith(payload.id, {
      ...payload.result,
      processingStatus: VideoProcessingStatus.READY,
    });
  });

  it('marks a video as failed when processing errors out', async () => {
    const { controller, videoService } = createController();

    await controller.failVideoProcessing({
      id: 'video-1',
      error: 'ffmpeg failed',
    } as never);

    expect(videoService.failProcessing).toHaveBeenCalledWith(
      'video-1',
      'ffmpeg failed',
    );
  });
});
