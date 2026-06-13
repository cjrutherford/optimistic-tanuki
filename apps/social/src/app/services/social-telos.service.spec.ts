import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { SocialTelosService } from './social-telos.service';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { CommunityMember } from '../../entities/community-member.entity';
import { Community } from '../../entities/community.entity';
import FollowEntity from '../../entities/Follow.entity';

describe('SocialTelosService', () => {
  let service: SocialTelosService;
  let postRepository: jest.Mocked<Repository<Post>>;
  let commentRepository: jest.Mocked<Repository<Comment>>;
  let communityMemberRepository: jest.Mocked<Repository<CommunityMember>>;
  let communityRepository: jest.Mocked<Repository<Community>>;
  let followRepository: jest.Mocked<Repository<FollowEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialTelosService,
        {
          provide: getRepositoryToken(Post),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(CommunityMember),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Community),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(FollowEntity),
          useValue: { count: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SocialTelosService);
    postRepository = module.get(getRepositoryToken(Post));
    commentRepository = module.get(getRepositoryToken(Comment));
    communityMemberRepository = module.get(getRepositoryToken(CommunityMember));
    communityRepository = module.get(getRepositoryToken(Community));
    followRepository = module.get(getRepositoryToken(FollowEntity));
  });

  it('builds normalized social facts from authored content and participation', async () => {
    postRepository.find.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Planning better trails',
        content: 'Planning mapping routes with community support',
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
      },
    ] as Post[]);
    commentRepository.find.mockResolvedValue([
      {
        id: 'comment-1',
        content: 'Mapping ideas for local support teams',
        createdAt: new Date('2026-06-06T10:00:00.000Z'),
      },
    ] as Comment[]);
    communityMemberRepository.find.mockResolvedValue([
      {
        id: 'membership-1',
        community: { id: 'community-1', name: 'Trail Guides' } as Community,
      },
    ] as CommunityMember[]);
    communityRepository.find.mockResolvedValue([
      { id: 'community-owned-1', name: 'Map Makers' } as Community,
    ]);
    followRepository.count.mockResolvedValueOnce(7).mockResolvedValueOnce(11);

    const facts = await service.getProfileFacts('profile-1');

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'social:summary',
          sourceId: 'profile-1',
          metadata: expect.objectContaining({
            counts: expect.objectContaining({
              posts: 1,
              comments: 1,
              memberships: 1,
              ownedCommunities: 1,
              following: 7,
              followers: 11,
            }),
          }),
        }),
        expect.objectContaining({
          sourceType: 'social:topics',
          metadata: expect.objectContaining({
            topics: expect.arrayContaining(['mapping', 'planning', 'support']),
          }),
        }),
        expect.objectContaining({
          sourceType: 'social:communities',
          metadata: { communities: ['Trail Guides'] },
        }),
        expect.objectContaining({
          sourceType: 'social:leadership',
          metadata: { ownedCommunities: ['Map Makers'] },
        }),
      ])
    );
  });
});
