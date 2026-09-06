import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { ProfileService } from '../profile.service';
import { of, throwError } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CommunityService } from '../community.service';
import { PostService } from '../post.service';
import { FollowService } from '../follow.service';
import { PrivacyService } from '../privacy.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: ProfileService;
  let router: Router;
  let profileServiceMock: Record<string, jest.Mock | (() => unknown)>;
  let privacyServiceMock: Record<string, jest.Mock | (() => unknown)>;

  const mockProfile: ProfileDto = {
    id: '1',
    profileName: 'Test Profile',
    profilePic: 'url/to/profile-pic',
    bio: 'This is a test profile',
    coverPic: 'url/to/cover-pic',
    userId: '231',
    location: 'Raleigh, NC',
    occupation: 'Product lead',
    interests: 'Communities, Product design',
    skills: 'Angular, Facilitation',
    created_at: new Date(),
  };

  const buildRoute = (params: Record<string, string> = {}) => ({
    paramMap: of(convertToParamMap(params)),
    snapshot: {
      paramMap: convertToParamMap(params) as ParamMap,
      data: {},
    },
  });

  const createComponent = async (
    routeParams: Record<string, string> = {},
    profileOverrides: Record<string, unknown> = {}
  ) => {
    profileServiceMock = {
      getCurrentUserProfile: jest.fn().mockReturnValue(mockProfile),
      selectProfile: jest.fn(),
      restorePersistedSelectedProfile: jest.fn(() => {
        const persisted = localStorage.getItem('ot-client-selectedProfile');
        return persisted ? JSON.parse(persisted) : null;
      }),
      getAllProfiles: jest.fn().mockResolvedValue([mockProfile]),
      getCurrentUserProfiles: jest.fn().mockReturnValue([mockProfile]),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
      getProfileById: jest.fn(),
      getDisplayProfile: jest.fn().mockReturnValue(of(mockProfile)),
      ...profileOverrides,
    };
    privacyServiceMock = {
      getBlockedUsers: jest.fn().mockReturnValue(of([])),
      blockUser: jest.fn().mockReturnValue(of(undefined)),
      unblockUser: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, RouterTestingModule],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: PrivacyService, useValue: privacyServiceMock },
        { provide: ActivatedRoute, useValue: buildRoute(routeParams) },
        {
          provide: MessageService,
          useValue: { addMessage: jest.fn() },
        },
        {
          provide: CommunityService,
          useValue: {
            getUserCommunities: jest.fn().mockReturnValue(of([])),
            getUserCommunitiesByProfileId: jest.fn().mockReturnValue(of([])),
            inviteUser: jest.fn().mockReturnValue(of(undefined)),
          },
        },
        {
          provide: PostService,
          useValue: {
            searchPosts: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: FollowService,
          useValue: {
            getFollowers: jest.fn().mockReturnValue(of([])),
            getFollowing: jest.fn().mockReturnValue(of([])),
            follow: jest.fn().mockReturnValue(of(undefined)),
            unfollow: jest.fn().mockReturnValue(of(undefined)),
          },
        },
        {
          provide: Router,
          useValue: { navigate: jest.fn() },
        },
      ],
    }).compileComponents();

    profileService = TestBed.inject(ProfileService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.removeItem('ot-client-selectedProfile');
    await createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call profileService.selectProfile on init if localStorage has namespaced selectedProfile', () => {
    const profileStringified = JSON.stringify(mockProfile);
    localStorage.setItem('ot-client-selectedProfile', profileStringified);

    TestBed.resetTestingModule();
    return createComponent().then(() => {
      expect(profileService.selectProfile).toHaveBeenCalledWith({
        ...mockProfile,
        created_at: mockProfile.created_at.toISOString(),
      });
      localStorage.removeItem('ot-client-selectedProfile');
    });
  });

  it('should get the current user profile from the profile service', () => {
    const profile = component.profile;
    expect(profileService.getCurrentUserProfile).toHaveBeenCalled();
    expect(profile).toEqual(mockProfile);
  });

  it('should redirect the base profile route to the selected profile id', async () => {
    TestBed.resetTestingModule();

    await createComponent({});

    expect(router.navigate).toHaveBeenCalledWith(['/profile', mockProfile.id], {
      replaceUrl: true,
    });
  });

  it('should render expanded profile details', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Profile identity');
    expect(text).toContain('Social proof');
    expect(text).toContain('Recent activity');
    expect(text).toContain('Raleigh, NC');
    expect(text).toContain('Product lead');
    expect(text).toContain('Angular');
    expect(text).toContain('Communities');
  });

  it('should split comma-separated profile tags', () => {
    expect(component.getProfileTags('Angular, Product, Community')).toEqual([
      'Angular',
      'Product',
      'Community',
    ]);
    expect(component.getProfileTags('')).toEqual([]);
  });

  it('builds completion prompts for missing owner fields', () => {
    const prompts = component.getProfileCompletionPrompts({
      ...mockProfile,
      bio: '',
      location: '',
      occupation: '',
      skills: '',
      interests: '',
      profilePic: '',
    });

    expect(prompts).toEqual(
      expect.arrayContaining([
        'Add a short bio so visitors know what you are about.',
        'Share your expertise or current role.',
        'Add your location to make local connections easier.',
        'List a few skills to show what you can help with.',
        'Add interests so communities and followers know what you enjoy.',
        'Upload a profile photo to make the page feel complete.',
      ])
    );
  });

  it('calculates profile completion from filled fields', () => {
    expect(component.getProfileCompletionScore(mockProfile)).toBe(100);
  });
});

describe('ProfileComponent interactions', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileServiceMock: Record<string, jest.Mock>;
  let privacyServiceMock: Record<string, jest.Mock>;
  let communityServiceMock: Record<string, jest.Mock>;
  let postServiceMock: Record<string, jest.Mock>;
  let followServiceMock: Record<string, jest.Mock>;
  let messageServiceMock: { addMessage: jest.Mock };
  let router: { navigate: jest.Mock };
  let errorSpy: jest.SpyInstance;

  const owner: ProfileDto = {
    id: '1',
    profileName: 'Test Profile',
    profilePic: 'url/to/profile-pic',
    bio: 'This is a test profile',
    coverPic: 'url/to/cover-pic',
    userId: '231',
    location: 'Raleigh, NC',
    occupation: 'Product lead',
    interests: 'Communities, Product design',
    skills: 'Angular, Facilitation',
    created_at: new Date(0),
  };
  const other: ProfileDto = { ...owner, id: '2', profileName: 'Other' };

  const build = async (
    routeParams: Record<string, string> = {},
    overrides: Record<string, unknown> = {}
  ) => {
    TestBed.resetTestingModule();
    profileServiceMock = {
      getCurrentUserProfile: jest.fn().mockReturnValue(owner),
      selectProfile: jest.fn(),
      restorePersistedSelectedProfile: jest.fn().mockReturnValue(null),
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      getCurrentUserProfiles: jest.fn().mockReturnValue([owner]),
      createProfile: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue(undefined),
      getProfileById: jest.fn(),
      getDisplayProfile: jest.fn().mockReturnValue(of(other)),
      ...overrides,
    } as Record<string, jest.Mock>;
    privacyServiceMock = {
      getBlockedUsers: jest.fn().mockReturnValue(of([])),
      blockUser: jest.fn().mockReturnValue(of(undefined)),
      unblockUser: jest.fn().mockReturnValue(of(undefined)),
    };
    communityServiceMock = {
      getUserCommunities: jest.fn().mockReturnValue(of([])),
      getUserCommunitiesByProfileId: jest.fn().mockReturnValue(of([])),
      inviteUser: jest.fn().mockReturnValue(of(undefined)),
    };
    postServiceMock = { searchPosts: jest.fn().mockReturnValue(of([])) };
    followServiceMock = {
      getFollowers: jest.fn().mockReturnValue(of([])),
      getFollowing: jest.fn().mockReturnValue(of([])),
      follow: jest.fn().mockReturnValue(of(undefined)),
      unfollow: jest.fn().mockReturnValue(of(undefined)),
    };
    messageServiceMock = { addMessage: jest.fn() };
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, RouterTestingModule],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: PrivacyService, useValue: privacyServiceMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: PostService, useValue: postServiceMock },
        { provide: FollowService, useValue: followServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeParams)),
            snapshot: {
              paramMap: convertToParamMap(routeParams) as ParamMap,
              data: {},
            },
          },
        },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  describe('constructor', () => {
    it('re-selects a persisted profile', async () => {
      await build(
        { userId: '2' },
        {
          restorePersistedSelectedProfile: jest.fn().mockReturnValue(owner),
        }
      );

      expect(profileServiceMock['selectProfile']).toHaveBeenCalledWith(owner);
    });
  });

  describe('loadSelfProfile', () => {
    it('loads the current profile when no route id and no selected profile id', async () => {
      await build(
        {},
        {
          getCurrentUserProfile: jest.fn().mockReturnValue({
            ...owner,
            id: '',
          }),
        }
      );

      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.isViewingOther).toBe(false);
      expect(component.viewingUserId).toBeNull();
      expect(profileServiceMock['getAllProfiles']).toHaveBeenCalled();
    });

    it('loads posts, communities and social proof for the signed-in profile', async () => {
      await build(
        {},
        {
          getCurrentUserProfile: jest
            .fn()
            .mockReturnValueOnce(null)
            .mockReturnValue(owner),
        }
      );

      expect(postServiceMock['searchPosts']).toHaveBeenCalledWith(
        { profileId: '1' },
        { orderBy: 'createdAt', orderDirection: 'desc', limit: 20 }
      );
      expect(
        communityServiceMock['getUserCommunitiesByProfileId']
      ).toHaveBeenCalledWith('1');
      expect(followServiceMock['getFollowers']).toHaveBeenCalledWith('1');
      expect(component.viewingUserId).toBe('1');
      expect(component.isBlocked()).toBe(false);
    });

    it('re-selects the persisted profile after reloading all profiles', async () => {
      const restore = jest
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValue(owner);
      await build(
        {},
        {
          getCurrentUserProfile: jest
            .fn()
            .mockReturnValueOnce(null)
            .mockReturnValue(owner),
          restorePersistedSelectedProfile: restore,
        }
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(profileServiceMock['selectProfile']).toHaveBeenCalledWith(owner);
    });

    it('bounces to settings when navigation state asks for the profile modal', async () => {
      jest.useFakeTimers();
      Object.defineProperty(window.history, 'state', {
        configurable: true,
        get: () => ({
          showProfileModal: true,
          profileMessage: 'Create a profile',
        }),
      });
      try {
        await build(
          {},
          {
            getCurrentUserProfile: jest
              .fn()
              .mockReturnValueOnce(null)
              .mockReturnValue(owner),
          }
        );

        jest.advanceTimersByTime(200);

        expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
          content: 'Create a profile',
          type: 'warning',
        });
      } finally {
        jest.useRealTimers();
        delete (window.history as unknown as Record<string, unknown>)['state'];
      }
    });
  });

  describe('loadViewingUserProfile', () => {
    it('loads another profile and checks the follow status', async () => {
      await build({ userId: '2' });

      expect(component.isViewingOther).toBe(true);
      expect(component.viewingUserProfile()).toEqual(other);
      expect(followServiceMock['getFollowing']).toHaveBeenCalledWith('1');
      expect(component.profile).toEqual(other);
    });

    it('marks the viewer as following when the following list contains the id', async () => {
      await build({ userId: '2' }, {});
      followServiceMock['getFollowing'].mockReturnValue(
        of([{ followeeId: '2' }])
      );
      (
        component as unknown as { checkFollowStatus: (id: string) => void }
      ).checkFollowStatus('2');

      expect(component.isFollowing()).toBe(true);
    });

    it('does not check the follow status when viewing your own id', async () => {
      await build(
        { userId: '1' },
        {
          getDisplayProfile: jest.fn().mockReturnValue(of(owner)),
        }
      );

      expect(component.isViewingOther).toBe(false);
      expect(component.isFollowing()).toBe(false);
    });

    it('reports a failure to load the profile', async () => {
      await build(
        { userId: '2' },
        {
          getDisplayProfile: jest
            .fn()
            .mockReturnValue(throwError(() => new Error('gone'))),
        }
      );

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load profile',
        type: 'error',
      });
    });
  });

  describe('loading failures', () => {
    it('logs each failed side load', async () => {
      await build({ userId: '2' }, {});
      postServiceMock['searchPosts'].mockReturnValue(
        throwError(() => new Error('posts'))
      );
      communityServiceMock['getUserCommunitiesByProfileId'].mockReturnValue(
        throwError(() => new Error('communities'))
      );
      followServiceMock['getFollowers'].mockReturnValue(
        throwError(() => new Error('followers'))
      );
      followServiceMock['getFollowing'].mockReturnValue(
        throwError(() => new Error('following'))
      );
      communityServiceMock['getUserCommunities'].mockReturnValue(
        throwError(() => new Error('owned'))
      );

      const internals = component as unknown as {
        loadUserPosts: (id: string) => void;
        loadUserCommunities: (id: string) => void;
        loadSocialProof: (id: string) => void;
        checkFollowStatus: (id: string) => void;
        loadOwnedCommunities: () => void;
      };
      internals.loadUserPosts('2');
      internals.loadUserCommunities('2');
      internals.loadSocialProof('2');
      internals.checkFollowStatus('2');
      internals.loadOwnedCommunities();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load user posts',
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load user communities',
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load followers',
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to check follow status',
        expect.any(Error)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load owned communities',
        expect.any(Error)
      );
    });

    it('counts followers and following only for array payloads', async () => {
      await build({ userId: '2' }, {});
      followServiceMock['getFollowers'].mockReturnValue(of([{ id: 'a' }]));
      followServiceMock['getFollowing'].mockReturnValue(of(null));

      (
        component as unknown as { loadSocialProof: (id: string) => void }
      ).loadSocialProof('2');

      expect(component.followersCount()).toBe(1);
      expect(component.followingCount()).toBe(0);
    });

    it('skips the follow check without a signed-in profile', async () => {
      await build({ userId: '2' }, {});
      profileServiceMock['getCurrentUserProfile'].mockReturnValue(null);
      followServiceMock['getFollowing'].mockClear();

      (
        component as unknown as { checkFollowStatus: (id: string) => void }
      ).checkFollowStatus('2');

      expect(followServiceMock['getFollowing']).not.toHaveBeenCalled();
    });
  });

  describe('loadOwnedCommunities', () => {
    it('keeps only communities the signed-in user owns', async () => {
      await build({ userId: '2' }, {});
      communityServiceMock['getUserCommunities'].mockReturnValue(
        of([
          { id: 'c1', name: 'Mine', ownerId: '231' },
          { id: 'c2', name: 'By profile', ownerProfileId: '1' },
          { id: 'c3', name: 'Co-owned', ownerIds: ['1', 'x'] },
          { id: 'c4', name: 'Theirs', ownerId: '999' },
        ])
      );

      (
        component as unknown as { loadOwnedCommunities: () => void }
      ).loadOwnedCommunities();

      expect(component.ownedCommunities()).toEqual([
        { id: 'c1', name: 'Mine' },
        { id: 'c2', name: 'By profile' },
        { id: 'c3', name: 'Co-owned' },
      ]);
    });

    it('does nothing without a signed-in profile', async () => {
      await build({ userId: '2' }, {});
      profileServiceMock['getCurrentUserProfile'].mockReturnValue(null);
      communityServiceMock['getUserCommunities'].mockReturnValue(
        of([{ id: 'c1', name: 'Mine', ownerId: '231' }])
      );

      (
        component as unknown as { loadOwnedCommunities: () => void }
      ).loadOwnedCommunities();

      expect(component.ownedCommunities()).toEqual([]);
    });
  });

  describe('editor', () => {
    it('opens the editor for your own profile', async () => {
      await build(
        { userId: '1' },
        {
          getDisplayProfile: jest.fn().mockReturnValue(of(owner)),
        }
      );

      component.onBannerClick();
      expect(component.showProfileEditor).toBe(true);

      component.onProfileEditorClose();
      expect(component.showProfileEditor).toBe(false);

      component.openProfileEditor();
      expect(component.showProfileEditor).toBe(true);
    });

    it('keeps the editor closed when viewing someone else', async () => {
      await build({ userId: '2' });

      component.onBannerClick();
      component.openProfileEditor();

      expect(component.showProfileEditor).toBe(false);
    });

    it('saves an update and closes the editor', async () => {
      await build(
        { userId: '1' },
        {
          getDisplayProfile: jest.fn().mockReturnValue(of(owner)),
        }
      );
      component.showProfileEditor = true;

      component.updateProfile({ id: '1', bio: '' } as never);
      await Promise.resolve();
      await Promise.resolve();

      expect(profileServiceMock['updateProfile']).toHaveBeenCalledWith('1', {
        id: '1',
        bio: '',
      });
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Profile updated and selected!',
        type: 'success',
      });
      expect(component.showProfileEditor).toBe(false);
    });

    it('creates a profile then reloads the list', async () => {
      await build(
        { userId: '1' },
        {
          getDisplayProfile: jest.fn().mockReturnValue(of(owner)),
        }
      );
      component.showProfileEditor = true;

      component.createProfile({ name: 'New' } as never);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(profileServiceMock['createProfile']).toHaveBeenCalled();
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Profile created and selected!',
        type: 'success',
      });
      expect(component.showProfileEditor).toBe(false);
    });

    it('selects a profile and moves to the feed', async () => {
      await build({ userId: '2' });
      jest.useFakeTimers();
      try {
        component.selectProfile(other);

        expect(profileServiceMock['selectProfile']).toHaveBeenCalledWith(other);
        expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
          content: 'Profile selected!',
          type: 'success',
        });

        jest.advanceTimersByTime(500);
        expect(router.navigate).toHaveBeenCalledWith(['/feed']);
      } finally {
        jest.useRealTimers();
      }
    });

    it('navigates to settings', async () => {
      await build({ userId: '2' });
      component.goToSettings();
      expect(router.navigate).toHaveBeenCalledWith(['/settings']);
    });
  });

  describe('follow and block', () => {
    beforeEach(async () => {
      await build({ userId: '2' });
    });

    it('follows a profile', () => {
      component.onFollowToggle();

      expect(followServiceMock['follow']).toHaveBeenCalledWith({
        followerId: '1',
        followeeId: '2',
      });
      expect(component.isFollowing()).toBe(true);
      expect(component.followersCount()).toBe(1);
    });

    it('unfollows a profile and never goes below zero', () => {
      component.isFollowing.set(true);
      component.followersCount.set(0);

      component.onFollowToggle();

      expect(followServiceMock['unfollow']).toHaveBeenCalled();
      expect(component.isFollowing()).toBe(false);
      expect(component.followersCount()).toBe(0);
    });

    it('logs follow and unfollow failures', () => {
      followServiceMock['follow'].mockReturnValue(
        throwError(() => new Error('nope'))
      );
      component.onFollowToggle();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to follow',
        expect.any(Error)
      );

      followServiceMock['unfollow'].mockReturnValue(
        throwError(() => new Error('nope'))
      );
      component.isFollowing.set(true);
      component.onFollowToggle();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to unfollow',
        expect.any(Error)
      );
    });

    it('does nothing without both profiles', () => {
      component.viewingUserProfile.set(null);
      component.onFollowToggle();
      component.onBlockToggle();

      expect(followServiceMock['follow']).not.toHaveBeenCalled();
      expect(privacyServiceMock['blockUser']).not.toHaveBeenCalled();
    });

    it('blocks and unblocks a profile', () => {
      component.onBlockToggle();
      expect(privacyServiceMock['blockUser']).toHaveBeenCalledWith({
        blockedId: '2',
      });
      expect(component.isBlocked()).toBe(true);

      component.onBlockToggle();
      expect(privacyServiceMock['unblockUser']).toHaveBeenCalledWith('2');
      expect(component.isBlocked()).toBe(false);
    });

    it('logs block and unblock failures', () => {
      privacyServiceMock['blockUser'].mockReturnValue(
        throwError(() => new Error('nope'))
      );
      component.onBlockToggle();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to block',
        expect.any(Error)
      );

      privacyServiceMock['unblockUser'].mockReturnValue(
        throwError(() => new Error('nope'))
      );
      component.isBlocked.set(true);
      component.onBlockToggle();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to unblock',
        expect.any(Error)
      );
    });

    it('opens a direct message thread', () => {
      component.onMessage();
      expect(router.navigate).toHaveBeenCalledWith(['/messages'], {
        queryParams: { userId: '2' },
      });
    });

    it('does not open a message thread without a viewed profile', () => {
      component.viewingUserProfile.set(null);
      router.navigate.mockClear();
      component.onMessage();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('onInviteToCommunity', () => {
    beforeEach(async () => {
      await build({ userId: '2' });
      component.ownedCommunities.set([{ id: 'c1', name: 'Mine' }]);
    });

    it('invites the viewed profile to an owned community', () => {
      component.onInviteToCommunity('c1');

      expect(communityServiceMock['inviteUser']).toHaveBeenCalledWith(
        'c1',
        '2'
      );
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Invited to Mine',
        type: 'success',
      });
    });

    it('ignores a community the user does not own', () => {
      component.onInviteToCommunity('c9');
      expect(communityServiceMock['inviteUser']).not.toHaveBeenCalled();
    });

    it('ignores the invite without a viewed profile', () => {
      component.viewingUserProfile.set(null);
      component.onInviteToCommunity('c1');
      expect(communityServiceMock['inviteUser']).not.toHaveBeenCalled();
    });

    it('logs an invite failure', () => {
      communityServiceMock['inviteUser'].mockReturnValue(
        throwError(() => new Error('nope'))
      );
      component.onInviteToCommunity('c1');
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to invite',
        expect.any(Error)
      );
    });
  });

  describe('derived views', () => {
    beforeEach(async () => {
      await build({ userId: '2' });
    });

    it('splits highlighted and recent posts', () => {
      component.userPosts.set(
        Array.from({ length: 8 }, (_, i) => ({ id: String(i) } as never))
      );

      expect(component.highlightedPosts()).toHaveLength(2);
      expect(component.recentPosts().map((p) => p.id)).toEqual([
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('features the three largest communities', () => {
      component.userCommunities.set([
        { id: 'a', name: 'A', memberCount: 1 },
        { id: 'b', name: 'B', memberCount: 9 },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D', memberCount: 5 },
      ] as never);

      expect(component.featuredCommunities().map((c) => c.id)).toEqual([
        'b',
        'd',
        'a',
      ]);
    });

    it('returns no completion prompts when viewing someone else', () => {
      expect(component.getProfileCompletionPrompts(other)).toEqual([]);
    });

    it('scores a missing profile as zero', () => {
      expect(component.getProfileCompletionScore(null)).toBe(0);
      expect(component.getProfileCompletionScore(undefined)).toBe(0);
    });
  });
});
