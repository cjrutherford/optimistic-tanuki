import { Repository } from 'typeorm';
import {
  VideoProcessingStatus,
  VideoVisibility,
} from '@optimistic-tanuki/models';
import { VideoTelosService } from './video-telos.service';
import { Channel } from '../../entities/channel.entity';
import { ChannelSubscription } from '../../entities/channel-subscription.entity';
import { Video } from '../../entities/video.entity';

describe('VideoTelosService', () => {
  let channelRepository: jest.Mocked<Partial<Repository<Channel>>>;
  let videoRepository: jest.Mocked<Partial<Repository<Video>>>;
  let subscriptionRepository: jest.Mocked<
    Partial<Repository<ChannelSubscription>>
  >;
  let service: VideoTelosService;

  beforeEach(() => {
    channelRepository = {
      find: jest.fn(),
    };
    videoRepository = {
      find: jest.fn(),
    };
    subscriptionRepository = {
      count: jest.fn(),
    };

    service = new VideoTelosService(
      channelRepository as Repository<Channel>,
      videoRepository as Repository<Video>,
      subscriptionRepository as Repository<ChannelSubscription>
    );
  });

  it('summarizes channels, videos, topics, and subscribers for a profile', async () => {
    channelRepository.find!.mockResolvedValue([
      {
        id: 'channel-1',
        profileId: 'profile-1',
        name: 'Builder Broadcast',
        description: 'Deep dives on systems design',
        communitySlug: 'builders-guild',
        createdAt: new Date('2026-05-01T00:00:00Z'),
      },
      {
        id: 'channel-2',
        profileId: 'profile-1',
        name: 'Design Signals',
        description: 'Design critiques and workshops',
        communitySlug: 'design-forge',
        createdAt: new Date('2026-04-01T00:00:00Z'),
      },
    ] as Channel[]);
    videoRepository.find!.mockResolvedValue([
      {
        id: 'video-1',
        channelId: 'channel-1',
        title: 'Systems Design Patterns',
        description: 'Patterns for resilient services',
        processingStatus: VideoProcessingStatus.READY,
        visibility: VideoVisibility.PUBLIC,
        publishedAt: new Date('2026-06-01T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
      {
        id: 'video-2',
        channelId: 'channel-2',
        title: 'Workshop Critique',
        description: 'Live workshop on interface critique',
        processingStatus: VideoProcessingStatus.PENDING,
        visibility: VideoVisibility.UNLISTED,
        publishedAt: null,
        createdAt: new Date('2026-05-15T00:00:00Z'),
      },
    ] as unknown as Video[]);
    subscriptionRepository
      .count!.mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3);

    const facts = await service.getProfileFacts('profile-1');

    expect(channelRepository.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      order: { createdAt: 'DESC' },
      take: 8,
    });
    expect(videoRepository.find).toHaveBeenCalledWith({
      where: [{ channelId: 'channel-1' }, { channelId: 'channel-2' }],
      order: { createdAt: 'DESC' },
      take: 20,
    });
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'videos:summary',
          metadata: {
            counts: {
              channels: 2,
              videos: 2,
              readyVideos: 1,
              publicVideos: 1,
              publishedVideos: 1,
              subscribers: 10,
            },
          },
        }),
        expect.objectContaining({
          sourceType: 'videos:topics',
          metadata: expect.objectContaining({
            topics: expect.arrayContaining(['design', 'patterns', 'workshop']),
          }),
        }),
        expect.objectContaining({
          sourceType: 'videos:publishing',
          metadata: expect.objectContaining({
            recentChannels: ['Builder Broadcast', 'Design Signals'],
            recentVideoTitles: ['Systems Design Patterns', 'Workshop Critique'],
          }),
        }),
        expect.objectContaining({
          sourceType: 'videos:communities',
          metadata: {
            communities: ['builders-guild', 'design-forge'],
          },
        }),
      ])
    );
  });

  it('returns only a summary fact when the profile has no channels', async () => {
    channelRepository.find!.mockResolvedValue([]);

    const facts = await service.getProfileFacts('profile-1');

    expect(videoRepository.find).not.toHaveBeenCalled();
    expect(subscriptionRepository.count).not.toHaveBeenCalled();
    expect(facts).toEqual([
      expect.objectContaining({
        sourceType: 'videos:summary',
        metadata: {
          counts: {
            channels: 0,
            videos: 0,
            readyVideos: 0,
            publicVideos: 0,
            publishedVideos: 0,
            subscribers: 0,
          },
        },
      }),
    ]);
  });
});
