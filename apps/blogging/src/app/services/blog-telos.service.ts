import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileTelosSourceFactDto } from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Event } from '../entities/event.entity';

@Injectable()
export class BlogTelosService {
  private readonly stopWords = new Set([
    'about',
    'after',
    'been',
    'blog',
    'from',
    'have',
    'into',
    'local',
    'more',
    'post',
    'that',
    'their',
    'them',
    'they',
    'this',
    'with',
    'workshop',
    'your',
  ]);

  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepository: Repository<Post>,
    @Inject(getRepositoryToken(Event))
    private readonly eventRepository: Repository<Event>
  ) {}

  async getProfileFacts(
    profileId: string
  ): Promise<ProfileTelosSourceFactDto[]> {
    const [posts, events] = await Promise.all([
      this.postRepository.find({
        where: { authorId: profileId },
        order: { createdAt: 'DESC' },
        take: 12,
      }),
      this.eventRepository.find({
        where: { organizerId: profileId },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
    ]);

    const publishedPosts = posts.filter((post) => !post.isDraft);
    const draftPosts = posts.filter((post) => post.isDraft);
    const topics = this.extractTopTopics([
      ...posts.flatMap((post) => [post.title, post.content]),
      ...events.flatMap((event) => [event.name, event.description]),
    ]);
    const recentTitles = posts.map((post) => post.title).slice(0, 4);
    const eventNames = events.map((event) => event.name).slice(0, 4);
    const locations = [
      ...new Set(events.map((event) => event.location).filter(Boolean)),
    ].slice(0, 4);

    const facts: ProfileTelosSourceFactDto[] = [
      {
        sourceType: 'blogging:summary',
        sourceId: profileId,
        title: 'Blogging activity summary',
        content: `Blogging activity includes ${posts.length} posts, ${publishedPosts.length} published posts, ${draftPosts.length} drafts, and ${events.length} events.`,
        metadata: {
          counts: {
            posts: posts.length,
            publishedPosts: publishedPosts.length,
            draftPosts: draftPosts.length,
            events: events.length,
          },
        },
      },
    ];

    if (topics.length > 0) {
      facts.push({
        sourceType: 'blogging:topics',
        sourceId: profileId,
        title: 'Recurring blogging topics',
        content: `Recurring blogging topics include ${topics.join(', ')}.`,
        metadata: { topics },
      });
    }

    if (recentTitles.length > 0) {
      facts.push({
        sourceType: 'blogging:publishing',
        sourceId: profileId,
        title: 'Recent post titles',
        content: `Recent post titles include ${recentTitles.join(', ')}.`,
        metadata: {
          recentTitles,
          publishedTitles: publishedPosts.map((post) => post.title).slice(0, 4),
          draftTitles: draftPosts.map((post) => post.title).slice(0, 4),
        },
      });
    }

    if (eventNames.length > 0) {
      facts.push({
        sourceType: 'blogging:events',
        sourceId: profileId,
        title: 'Blogging events',
        content: `Organized events such as ${eventNames.join(', ')}${
          locations.length ? ` in ${locations.join(', ')}` : ''
        }.`,
        metadata: {
          eventNames,
          locations,
        },
      });
    }

    return facts;
  }

  private extractTopTopics(values: string[]): string[] {
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

  private tokenize(value: string): string[] {
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
