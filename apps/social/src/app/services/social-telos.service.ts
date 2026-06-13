import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileTelosSourceFactDto } from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { CommunityMember } from '../../entities/community-member.entity';
import { Community } from '../../entities/community.entity';
import FollowEntity from '../../entities/Follow.entity';

@Injectable()
export class SocialTelosService {
  private readonly stopWords = new Set([
    'about',
    'after',
    'also',
    'been',
    'build',
    'from',
    'have',
    'into',
    'just',
    'more',
    'much',
    'that',
    'their',
    'them',
    'they',
    'this',
    'with',
    'your',
  ]);

  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepository: Repository<Post>,
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepository: Repository<Comment>,
    @Inject(getRepositoryToken(CommunityMember))
    private readonly communityMemberRepository: Repository<CommunityMember>,
    @Inject(getRepositoryToken(Community))
    private readonly communityRepository: Repository<Community>,
    @Inject(getRepositoryToken(FollowEntity))
    private readonly followRepository: Repository<FollowEntity>
  ) {}

  async getProfileFacts(
    profileId: string
  ): Promise<ProfileTelosSourceFactDto[]> {
    const [
      posts,
      comments,
      memberships,
      ownedCommunities,
      followingCount,
      followerCount,
    ] = await Promise.all([
      this.postRepository.find({
        where: { profileId, moderationStatus: 'visible' },
        order: { createdAt: 'DESC' },
        take: 12,
      }),
      this.commentRepository.find({
        where: { profileId, moderationStatus: 'visible' },
        order: { createdAt: 'DESC' },
        take: 12,
      }),
      this.communityMemberRepository.find({
        where: { profileId, status: 'approved' as any },
        relations: ['community'],
        take: 6,
      }),
      this.communityRepository.find({
        where: { ownerProfileId: profileId },
        order: { createdAt: 'DESC' },
        take: 4,
      }),
      this.followRepository.count({ where: { followerId: profileId } }),
      this.followRepository.count({ where: { followeeId: profileId } }),
    ]);

    const topics = this.extractTopTopics([
      ...posts.flatMap((post) => [post.title, post.content]),
      ...comments.map((comment) => comment.content),
    ]);
    const communityNames = memberships
      .map((membership) => membership.community?.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 4);
    const ownedCommunityNames = ownedCommunities
      .map((community) => community.name)
      .filter(Boolean)
      .slice(0, 3);
    const latestActivityAt = [posts[0]?.createdAt, comments[0]?.createdAt]
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const facts: ProfileTelosSourceFactDto[] = [
      {
        sourceType: 'social:summary',
        sourceId: profileId,
        title: 'Social activity summary',
        content: `Social activity includes ${posts.length} posts, ${comments.length} comments, ${memberships.length} community memberships, ${ownedCommunities.length} owned communities, ${followingCount} following connections, and ${followerCount} followers.`,
        metadata: {
          counts: {
            posts: posts.length,
            comments: comments.length,
            memberships: memberships.length,
            ownedCommunities: ownedCommunities.length,
            following: followingCount,
            followers: followerCount,
          },
          topics,
          latestActivityAt: latestActivityAt?.toISOString() ?? null,
        },
      },
    ];

    if (topics.length > 0) {
      facts.push({
        sourceType: 'social:topics',
        sourceId: profileId,
        title: 'Recurring social topics',
        content: `Recurring social topics include ${topics.join(', ')}.`,
        metadata: { topics },
      });
    }

    if (communityNames.length > 0) {
      facts.push({
        sourceType: 'social:communities',
        sourceId: profileId,
        title: 'Community participation',
        content: `Participates in communities such as ${communityNames.join(
          ', '
        )}.`,
        metadata: { communities: communityNames },
      });
    }

    if (ownedCommunityNames.length > 0) {
      facts.push({
        sourceType: 'social:leadership',
        sourceId: profileId,
        title: 'Community leadership',
        content: `Owns or leads communities including ${ownedCommunityNames.join(
          ', '
        )}.`,
        metadata: { ownedCommunities: ownedCommunityNames },
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
