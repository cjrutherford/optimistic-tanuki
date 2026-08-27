import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { FeedComponent } from './feed.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { SocialWebSocketService } from '../../social-websocket.service';
import { AssetService } from '../../asset.service';
import { FollowService } from '../../follow.service';
import { CommunityService } from '../../community.service';
import { VoteService } from '../../vote.service';
import { ReactionService } from '../../reaction.service';
import { ActivityService } from '../../activity.service';
import { throwError } from 'rxjs';
import { SocialFeedDataService } from '@optimistic-tanuki/social-data-access';
import { MessageService } from '@optimistic-tanuki/message-ui';

describe('FeedComponent', () => {
  let component: FeedComponent & Partial<OnDestroy>;
  let fixture: ComponentFixture<FeedComponent>;
  let postService: PostService;
  let profileService: ProfileService;
  let router: Router;
  let socialFeedData: {
    loadPublicFeed: jest.Mock;
    loadFollowingFeed: jest.Mock;
    loadUserCommunities: jest.Mock;
    loadCommunityFeed: jest.Mock;
  };
  let messageService: { addMessage: jest.Mock };
  let consoleLogSpy: jest.SpyInstance;

  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });

    const themeServiceMock = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#212121',
        accent: '#3f51b5',
      }),
      getTheme: jest.fn().mockReturnValue('light'),
    };
    const postServiceMock = {
      searchPosts: jest.fn().mockReturnValue(of([])),
      createPost: jest
        .fn()
        .mockReturnValue(of({ id: 'new-post', profileId: '123' })),
      updatePost: jest.fn().mockReturnValue(
        of({
          id: 'post-1',
          title: 'Updated',
          content: 'Updated body',
          profileId: '123',
          userId: 'user-1',
          createdAt: new Date('2026-07-05T10:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:05:00.000Z'),
        })
      ),
      deletePost: jest.fn().mockReturnValue(of(undefined)),
      getPost: jest.fn().mockReturnValue(of(null)),
      getFeed: jest.fn().mockReturnValue(of([])),
      getPostsByCommunityIds: jest.fn().mockReturnValue(of([])),
    };
    const profileServiceMock = {
      currentUserProfile: jest
        .fn()
        .mockReturnValue({ id: '123', profileName: 'Test', profilePic: 'url' }),
      getCurrentUserProfile: jest
        .fn()
        .mockReturnValue({ id: '123', profileName: 'Test', profilePic: 'url' }),
      getDisplayProfile: jest
        .fn()
        .mockReturnValue(
          of({ id: '1', profileName: 'Test', profilePic: 'url' })
        ),
    };
    const routerMock = {
      navigate: jest.fn(),
    };
    const socialWebSocketServiceMock = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      getConnectionStatus: jest.fn().mockReturnValue(of(false)),
      getPosts: jest.fn().mockReturnValue(of([])),
      getFeed: jest.fn(),
      subscribeToPosts: jest.fn(),
      unsubscribeFromPosts: jest.fn(),
    };
    const followServiceMock = {
      getFollowing: jest.fn().mockReturnValue(of([])),
      follow: jest.fn().mockReturnValue(of(undefined)),
      unfollow: jest.fn().mockReturnValue(of(undefined)),
    };
    const communityServiceMock = {
      getUserCommunities: jest.fn().mockReturnValue(of([])),
      getCommunity: jest.fn().mockReturnValue(of(null)),
      inviteUser: jest.fn().mockReturnValue(of(undefined)),
    };
    const voteServiceMock = {
      vote: jest.fn().mockReturnValue(of(undefined)),
      getVotesByPostId: jest.fn().mockReturnValue(of([])),
      getUserVoteForPost: jest.fn().mockReturnValue(of(null)),
    };
    const reactionServiceMock = {
      addReaction: jest.fn().mockReturnValue(of(undefined)),
      getReactionsByPost: jest.fn().mockReturnValue(of([])),
      getUserReaction: jest.fn().mockReturnValue(of(null)),
    };
    socialFeedData = {
      loadPublicFeed: jest.fn().mockReturnValue(of([])),
      loadFollowingFeed: jest.fn().mockReturnValue(of([])),
      loadUserCommunities: jest.fn().mockReturnValue(of([])),
      loadCommunityFeed: jest.fn().mockReturnValue(of([])),
    };
    messageService = { addMessage: jest.fn() };

    TestBed.overrideComponent(FeedComponent, {
      set: {
        template: '<div class="feed-test-host"></div>',
        imports: [],
        providers: [
          { provide: ThemeService, useValue: themeServiceMock },
          { provide: PostService, useValue: postServiceMock },
          {
            provide: AttachmentService,
            useValue: {
              createAttachment: jest.fn().mockReturnValue(of(undefined)),
            },
          },
          {
            provide: CommentService,
            useValue: {
              createComment: jest.fn().mockReturnValue(of(undefined)),
            },
          },
          {
            provide: SocialWebSocketService,
            useValue: socialWebSocketServiceMock,
          },
          {
            provide: AssetService,
            useValue: {
              createAsset: jest.fn().mockReturnValue(of({ id: 'asset-1' })),
              getAssetUrl: jest.fn().mockReturnValue('/asset/asset-1'),
            },
          },
          { provide: FollowService, useValue: followServiceMock },
          { provide: VoteService, useValue: voteServiceMock },
          { provide: ReactionService, useValue: reactionServiceMock },
          { provide: ActivityService, useValue: {} },
          { provide: SocialFeedDataService, useValue: socialFeedData },
          { provide: MessageService, useValue: messageService },
        ],
      },
    });

    TestBed.configureTestingModule({
      imports: [FeedComponent, HttpClientTestingModule, CommonModule],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: jest.fn().mockReturnValue(null) },
              queryParamMap: { get: jest.fn().mockReturnValue(null) },
            },
            queryParamMap: of({ get: jest.fn().mockReturnValue(null) }),
          },
        },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    postService = TestBed.inject(PostService);
    profileService = TestBed.inject(ProfileService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should create', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component).toBeTruthy();
  }));

  it('loads the public tab through the shared social data-access layer', () => {
    component.loadPublicFeed();

    expect(socialFeedData.loadPublicFeed).toHaveBeenCalledWith(
      { visibility: 'public', communityId: null },
      {
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: 20,
        offset: 0,
      }
    );
  });

  it('loads following posts through the shared social data-access layer', () => {
    fixture.detectChanges();
    component.followingIds.add('followed-profile');
    component.loadFollowingFeed();

    expect(socialFeedData.loadFollowingFeed).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
    });
  });

  it('loads community posts through the shared social data-access layer', () => {
    fixture.detectChanges();
    socialFeedData.loadUserCommunities.mockReturnValue(
      of([{ id: 'community-1' }])
    );
    component.loadCommunitiesFeed();

    expect(socialFeedData.loadCommunityFeed).toHaveBeenCalledWith(
      ['community-1'],
      { limit: 20, offset: 0 }
    );
  });

  it('waits for confirmation before deleting a post', () => {
    const post = { id: 'post-1', profileId: '123', title: 'Keep me' } as any;
    component.posts.set([post]);

    component.onDeletePost(post);

    expect(component.postPendingDeletion()).toBe(post);
    expect(component.postService.deletePost).not.toHaveBeenCalled();

    component.cancelPostDeletion();

    expect(component.postPendingDeletion()).toBeNull();
    expect(component.posts()).toEqual([post]);
  });

  it('deletes the confirmed post and closes the confirmation dialog', () => {
    const post = { id: 'post-1', profileId: '123', title: 'Remove me' } as any;
    component.posts.set([post]);
    component.onDeletePost(post);

    component.confirmPostDeletion();

    expect(component.postService.deletePost).toHaveBeenCalledWith('post-1');
    expect(component.posts()).toEqual([]);
    expect(component.postPendingDeletion()).toBeNull();
  });

  it('keeps the confirmation open and reports an error when deletion fails', () => {
    const deletionError = new Error('Service unavailable');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(component.postService, 'deletePost')
      .mockReturnValue(throwError(() => deletionError));
    const post = { id: 'post-1', profileId: '123', title: 'Keep me' } as any;
    component.posts.set([post]);
    component.onDeletePost(post);

    component.confirmPostDeletion();

    expect(component.posts()).toEqual([post]);
    expect(component.postPendingDeletion()).toBe(post);
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Your post could not be deleted. Please try again.',
      type: 'error',
    });
    consoleErrorSpy.mockRestore();
  });

  it('should not prepend a post when create fails with an isolation denial', async () => {
    const denial = new Error(
      'Forbidden: cannot create post for another profile'
    );
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(component.postService as any, 'createPost')
      .mockReturnValue(throwError(() => denial));
    component.posts.set([
      { id: 'existing-post', profileId: '123', title: 'Existing' } as any,
    ]);

    await expect(
      component.createdPost({
        title: 'Denied',
        content: 'Nope',
        attachments: [],
        links: [],
        injectedComponentsNew: [],
      })
    ).rejects.toBe(denial);

    expect(component.postService.createPost).toHaveBeenCalledWith({
      title: 'Denied',
      content: 'Nope',
      profileId: '123',
    });
    expect(component.posts()).toEqual([
      { id: 'existing-post', profileId: '123', title: 'Existing' },
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Feed] Failed to create post:',
      denial
    );
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Your post could not be published. Please try again.',
      type: 'error',
    });
    consoleErrorSpy.mockRestore();
  });

  it('updates an owned post in place after saving edits', async () => {
    const updatePostSpy = jest.spyOn(component.postService, 'updatePost');

    component.posts.set([
      {
        id: 'post-1',
        title: 'Original',
        content: 'Original body',
        profileId: '123',
        userId: 'user-1',
        createdAt: new Date('2026-07-05T10:00:00.000Z'),
      } as any,
    ]);

    await expect(
      (component as any).updatePost('post-1', {
        title: 'Updated',
        content: 'Updated body',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'post-1',
        title: 'Updated',
      })
    );

    expect(updatePostSpy).toHaveBeenCalledWith('post-1', {
      title: 'Updated',
      content: 'Updated body',
    });
    expect(component.posts()[0]).toEqual(
      expect.objectContaining({
        id: 'post-1',
        title: 'Updated',
        content: 'Updated body',
        updatedAt: expect.any(Date),
      })
    );
  });
});
