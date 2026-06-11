import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogTelosService } from './blog-telos.service';
import { Post } from '../entities/post.entity';
import { Event } from '../entities/event.entity';

describe('BlogTelosService', () => {
  let service: BlogTelosService;
  let postRepository: jest.Mocked<Repository<Post>>;
  let eventRepository: jest.Mocked<Repository<Event>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogTelosService,
        {
          provide: getRepositoryToken(Post),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Event),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BlogTelosService);
    postRepository = module.get(getRepositoryToken(Post));
    eventRepository = module.get(getRepositoryToken(Event));
  });

  it('builds normalized blogging facts from posts and events', async () => {
    postRepository.find.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Mapping community rituals',
        content: 'Planning support systems for local communities',
        isDraft: false,
        createdAt: new Date('2026-06-08T10:00:00.000Z'),
        publishedAt: new Date('2026-06-08T10:00:00.000Z'),
      },
      {
        id: 'post-2',
        title: 'Draft field notes',
        content: 'Early ideas for stewardship',
        isDraft: true,
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
        publishedAt: null,
      },
    ] as Post[]);
    eventRepository.find.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Community Mapping Workshop',
        description: 'A workshop for planning better local maps',
        location: 'Raleigh',
        createdAt: new Date('2026-06-06T10:00:00.000Z'),
        startTime: new Date('2026-06-12T10:00:00.000Z'),
      },
    ] as Event[]);

    const facts = await service.getProfileFacts('profile-1');

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'blogging:summary',
          metadata: expect.objectContaining({
            counts: expect.objectContaining({
              posts: 2,
              publishedPosts: 1,
              draftPosts: 1,
              events: 1,
            }),
          }),
        }),
        expect.objectContaining({
          sourceType: 'blogging:topics',
          metadata: expect.objectContaining({
            topics: expect.arrayContaining([
              'mapping',
              'community',
              'planning',
            ]),
          }),
        }),
        expect.objectContaining({
          sourceType: 'blogging:publishing',
          metadata: expect.objectContaining({
            recentTitles: ['Mapping community rituals', 'Draft field notes'],
          }),
        }),
        expect.objectContaining({
          sourceType: 'blogging:events',
          metadata: expect.objectContaining({
            locations: ['Raleigh'],
            eventNames: ['Community Mapping Workshop'],
          }),
        }),
      ])
    );
  });
});
