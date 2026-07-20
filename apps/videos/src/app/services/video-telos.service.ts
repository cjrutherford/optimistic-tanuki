import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ProfileTelosSourceFactDto,
  VideoProcessingStatus,
  VideoVisibility,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { Channel } from '../../entities/channel.entity';
import { ChannelSubscription } from '../../entities/channel-subscription.entity';
import { Video } from '../../entities/video.entity';

@Injectable()
export class VideoTelosService {
  private readonly stopWords = new Set([
    'about',
    'after',
    'channel',
    'episode',
    'from',
    'have',
    'into',
    'more',
    'series',
    'stream',
    'their',
    'them',
    'they',
    'this',
    'video',
    'with',
    'your',
  ]);

  constructor(
    @Inject(getRepositoryToken(Channel))
    private readonly channelRepository: Repository<Channel>,
    @Inject(getRepositoryToken(Video))
    private readonly videoRepository: Repository<Video>,
    @Inject(getRepositoryToken(ChannelSubscription))
    private readonly subscriptionRepository: Repository<ChannelSubscription>
  ) {}

  async getProfileFacts(
    profileId: string
  ): Promise<ProfileTelosSourceFactDto[]> {
    const channels = await this.channelRepository.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
      take: 8,
    });
    const channelIds = channels.map((channel) => channel.id);
    const videos = channelIds.length
      ? await this.videoRepository.find({
          where: channelIds.map((channelId) => ({ channelId })),
          order: { createdAt: 'DESC' },
          take: 20,
        })
      : [];
    const subscriberCounts = channelIds.length
      ? await Promise.all(
          channelIds.map((channelId) =>
            this.subscriptionRepository.count({ where: { channelId } })
          )
        )
      : [];

    const readyVideos = videos.filter(
      (video) => video.processingStatus === VideoProcessingStatus.READY
    );
    const publicVideos = videos.filter(
      (video) => video.visibility === VideoVisibility.PUBLIC
    );
    const publishedVideos = videos.filter((video) => video.publishedAt);
    const topics = this.extractTopTopics([
      ...channels.flatMap((channel) => [channel.name, channel.description]),
      ...videos.flatMap((video) => [video.title, video.description]),
    ]);
    const recentChannels = channels.map((channel) => channel.name).slice(0, 4);
    const recentVideoTitles = videos.map((video) => video.title).slice(0, 5);
    const totalSubscribers = subscriberCounts.reduce(
      (sum, count) => sum + count,
      0
    );
    const topCommunities = [
      ...new Set(
        channels.map((channel) => channel.communitySlug).filter(Boolean)
      ),
    ].slice(0, 4);

    const facts: ProfileTelosSourceFactDto[] = [
      {
        sourceType: 'videos:summary',
        sourceId: profileId,
        title: 'Video authorship summary',
        content: `Video activity includes ${channels.length} channels, ${videos.length} videos, ${readyVideos.length} ready videos, ${publicVideos.length} public videos, and ${totalSubscribers} subscribers across owned channels.`,
        metadata: {
          counts: {
            channels: channels.length,
            videos: videos.length,
            readyVideos: readyVideos.length,
            publicVideos: publicVideos.length,
            publishedVideos: publishedVideos.length,
            subscribers: totalSubscribers,
          },
        },
      },
    ];

    if (topics.length > 0) {
      facts.push({
        sourceType: 'videos:topics',
        sourceId: profileId,
        title: 'Recurring video topics',
        content: `Recurring video topics include ${topics.join(', ')}.`,
        metadata: { topics },
      });
    }

    if (recentChannels.length > 0 || recentVideoTitles.length > 0) {
      facts.push({
        sourceType: 'videos:publishing',
        sourceId: profileId,
        title: 'Channel and video catalog',
        content: `Recent channels include ${recentChannels.join(', ')}${
          recentVideoTitles.length
            ? `. Recent videos include ${recentVideoTitles.join(', ')}`
            : ''
        }.`,
        metadata: {
          recentChannels,
          recentVideoTitles,
        },
      });
    }

    if (topCommunities.length > 0) {
      facts.push({
        sourceType: 'videos:communities',
        sourceId: profileId,
        title: 'Video community anchors',
        content: `Video publishing is anchored in communities such as ${topCommunities.join(
          ', '
        )}.`,
        metadata: {
          communities: topCommunities,
        },
      });
    }

    return facts;
  }

  private extractTopTopics(values: Array<string | null | undefined>): string[] {
    const counts = new Map<string, number>();

    for (const value of values) {
      for (const token of this.tokenize(value)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private tokenize(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/[^a-zA-Z]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(
        (token) =>
          token.length >= 4 &&
          !this.stopWords.has(token) &&
          !/^\d+$/.test(token)
      );
  }
}
