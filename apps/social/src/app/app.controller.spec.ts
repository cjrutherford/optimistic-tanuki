import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostService } from './services/post.service';
import { VoteService } from './services/vote.service';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import FollowService from './services/follow.service';

describe('AppController', () => {
  let app: TestingModule;
  let postService: PostService;
  let voteService: VoteService;
  let attachmentService: AttachmentService;
  let commentService: CommentService;

  beforeAll(async () => {

    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        FollowService,
        { provide: PostService, useValue: postService },
        { provide: VoteService, useValue: voteService },
        { provide: AttachmentService, useValue: attachmentService },
        { provide: CommentService, useValue: commentService },
      ],
    })
    .overrideProvider(PostService)
    .useValue({
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    })
    .overrideProvider(VoteService)
    .useValue({
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    })
    .overrideProvider(AttachmentService)
    .useValue({
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    })
    .overrideProvider(CommentService)
    .useValue({
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    })
    .overrideProvider(FollowService)
    .useValue({
      follow: jest.fn(),
      unfollow: jest.fn(),
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
      getMutuals: jest.fn(),
      getFollowerCount: jest.fn(),
    })
    .compile();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController).toBeDefined();
    });

    it('should have postService defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController['postService']).toBeDefined();
    });

    it('should have voteService defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController['voteService']).toBeDefined();
    });

    it('should have attachmentService defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController['attachmentService']).toBeDefined();
    });

    it('should have commentService defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController['commentService']).toBeDefined();
    });
  });
});
