import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';
import { BehaviorSubject } from 'rxjs';
import {
  CommunityDto,
  CommunityJoinPolicy,
} from '@optimistic-tanuki/ui-models';
import { FindCommunitiesComponent } from './find-communities.component';
import { CommunityService } from '../services/community.service';

/**
 * TS4111 is on, so the double is described by a named interface rather than an
 * index signature.
 */
interface CommunityServiceMock {
  getCurrentUserProfile: jest.Mock;
  findAll: jest.Mock;
  getTopActive: jest.Mock;
  join: jest.Mock;
}

const currentProfile = {
  id: 'profile-1',
  userId: 'user-1',
  profileName: 'Current User',
  profilePic: '',
};

const buildCommunity = (overrides: Partial<CommunityDto>): CommunityDto => ({
  id: 'community-1',
  name: 'A Community',
  description: 'Description',
  ownerId: 'other-user',
  ownerProfileId: 'other-profile',
  appScope: 'social',
  isPrivate: false,
  joinPolicy: CommunityJoinPolicy.PUBLIC,
  tags: [],
  memberCount: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  memberIds: [],
  memberUserIds: [],
  ownerIds: ['other-user'],
  ...overrides,
});

describe('FindCommunitiesComponent behaviour', () => {
  let fixture: ComponentFixture<FindCommunitiesComponent>;
  let component: FindCommunitiesComponent;
  let communityService: CommunityServiceMock;

  const setup = () => {
    communityService = {
      getCurrentUserProfile: jest.fn().mockResolvedValue(currentProfile),
      findAll: jest.fn().mockResolvedValue([]),
      getTopActive: jest.fn().mockResolvedValue([]),
      join: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [FindCommunitiesComponent, RouterTestingModule],
      providers: [{ provide: CommunityService, useValue: communityService }],
    });

    fixture = TestBed.createComponent(FindCommunitiesComponent);
    component = fixture.componentInstance;
  };

  /** Runs ngOnInit and lets every kicked-off promise settle. */
  const initialise = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    setup();
    // Each failure path logs; silence it so failing assertions stay readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('theme variant', () => {
    const colors = {
      background: '#101010',
      foreground: '#f0f0f0',
      accent: '#4a90d9',
      complementary: '#d9a34a',
      complementaryGradients: {
        light: 'linear-gradient(90deg, #fff, #eee)',
        dark: 'linear-gradient(90deg, #000, #111)',
      },
    } as unknown as ThemeColors;

    it.each([
      {
        theme: 'light' as const,
        expected: 'linear-gradient(90deg, #fff, #eee)',
      },
      {
        theme: 'dark' as const,
        expected: 'linear-gradient(90deg, #000, #111)',
      },
    ])('picks the $theme complement gradient', ({ theme, expected }) => {
      component.theme = theme;

      component.applyVariant(colors);

      expect(component.borderGradient).toBe(expected);
      expect(component.background).toBe('#101010');
      expect(component.foreground).toBe('#f0f0f0');
      expect(component.accent).toBe('#4a90d9');
      expect(component.complement).toBe('#d9a34a');
      expect(component.borderColor).toBe('#d9a34a');
    });

    it.each([
      { name: 'no options', options: undefined, expected: 'default' },
      {
        name: 'an explicit variant',
        options: { variant: 'gradient-glow' as const },
        expected: 'gradient-glow',
      },
    ])('records the variant name for $name', ({ options, expected }) => {
      component.applyVariant(colors, options);

      expect(component.variant).toBe(expected);
    });

    it('applies the theme when the service emits colours', () => {
      // The override used to skip super.ngOnInit(), so Themeable never
      // subscribed and applyVariant was only ever reached by a direct call —
      // the component rendered unthemed in the app while its tests passed.
      TestBed.resetTestingModule();
      const emitted = new BehaviorSubject<ThemeColors | undefined>(undefined);

      TestBed.configureTestingModule({
        imports: [FindCommunitiesComponent, RouterTestingModule],
        providers: [
          { provide: CommunityService, useValue: communityService },
          {
            provide: ThemeService,
            useValue: {
              themeColors$: emitted.asObservable(),
              getTheme: () => 'light' as const,
            },
          },
        ],
      });

      const themed = TestBed.createComponent(FindCommunitiesComponent);
      const applyTheme = jest.spyOn(themed.componentInstance, 'applyTheme');

      themed.detectChanges();
      emitted.next(colors);

      expect(applyTheme).toHaveBeenCalledWith(colors);
    });
  });

  describe('loading failures', () => {
    it('leaves the top active list empty when the lookup rejects', async () => {
      communityService.getTopActive.mockRejectedValue(new Error('boom'));

      await initialise();

      expect(component.topActiveCommunities()).toEqual([]);
      expect(component.loading()).toBe(false);
    });

    it('leaves the community list empty when the lookup rejects', async () => {
      communityService.findAll.mockRejectedValue(new Error('boom'));

      await initialise();

      expect(component.communities()).toEqual([]);
      expect(component.loading()).toBe(false);
    });

    it('keeps memberships empty when the profile lookup rejects', async () => {
      communityService.findAll.mockResolvedValue([buildCommunity({})]);
      communityService.getCurrentUserProfile.mockRejectedValue(
        new Error('unauthenticated')
      );

      await initialise();

      expect(component.userMemberships().size).toBe(0);
      expect(component.currentUserId).toBe('');
    });

    it('keeps memberships empty when there is no signed in profile', async () => {
      communityService.findAll.mockResolvedValue([buildCommunity({})]);
      communityService.getCurrentUserProfile.mockResolvedValue(null);

      await initialise();

      expect(component.userMemberships().size).toBe(0);
      expect(component.userOwnerships().size).toBe(0);
    });
  });

  describe('search', () => {
    it('searches by name once the input settles', fakeAsync(() => {
      const match = buildCommunity({ id: 'community-9', name: 'Gardening' });
      fixture.detectChanges();
      tick(300);
      flushMicrotasks();
      communityService.findAll.mockResolvedValue([match]);

      component.searchControl.setValue('gard');
      tick(300);
      flushMicrotasks();

      expect(communityService.findAll).toHaveBeenLastCalledWith({
        name: 'gard',
      });
      expect(component.communities()).toEqual([match]);
      expect(component.loading()).toBe(false);
    }));

    it('reloads the unfiltered list when the query is blanked out', fakeAsync(() => {
      fixture.detectChanges();
      tick(300);
      flushMicrotasks();
      communityService.findAll.mockClear();

      component.searchControl.setValue('   ');
      tick(300);
      flushMicrotasks();

      expect(communityService.findAll).toHaveBeenCalledWith({});
      expect(communityService.getCurrentUserProfile).toHaveBeenCalled();
    }));

    it('keeps the previous results when the search request rejects', async () => {
      const existing = buildCommunity({ id: 'community-2' });
      communityService.findAll.mockResolvedValue([existing]);
      await initialise();

      communityService.findAll.mockRejectedValue(new Error('boom'));
      await component.searchCommunities('gard');

      expect(component.communities()).toEqual([existing]);
      expect(component.loading()).toBe(false);
    });
  });

  describe('membership derivation', () => {
    it('treats a listed member id as a membership without management rights', async () => {
      communityService.findAll.mockResolvedValue([
        buildCommunity({ id: 'community-2', memberIds: ['profile-1'] }),
      ]);

      await initialise();

      expect(component.getMembershipStatus('community-2')).toBe('member');
      expect(component.canManage('community-2')).toBe(false);
    });

    it('treats a listed member user id as a membership', async () => {
      communityService.findAll.mockResolvedValue([
        buildCommunity({ id: 'community-3', memberUserIds: ['user-1'] }),
      ]);

      await initialise();

      expect(component.getMembershipStatus('community-3')).toBe('member');
    });

    it('grants management rights through the owner id list', async () => {
      communityService.findAll.mockResolvedValue([
        buildCommunity({ id: 'community-4', ownerIds: ['user-1'] }),
      ]);

      await initialise();

      expect(component.canManage('community-4')).toBe(true);
      expect(component.getMembershipStatus('community-4')).toBe('member');
    });

    it('carries a pending request over a refresh of the community lists', async () => {
      communityService.findAll.mockResolvedValue([
        buildCommunity({ id: 'community-2' }),
      ]);
      await initialise();

      component.userMemberships.set(
        new Map([
          [
            'community-2',
            {
              id: 'membership-2',
              communityId: 'community-2',
              userId: 'user-1',
              profileId: 'profile-1',
              role: 'member',
              status: 'pending',
              joinedAt: new Date('2026-01-05T00:00:00.000Z'),
            } as never,
          ],
        ])
      );

      await component.loadUserMemberships();

      expect(component.getMembershipStatus('community-2')).toBe('pending');
    });

    it('drops a community the user has no relationship with', async () => {
      communityService.findAll.mockResolvedValue([
        buildCommunity({ id: 'community-5' }),
      ]);

      await initialise();

      expect(component.getMembershipStatus('community-5')).toBe('none');
      expect(component.userMemberships().has('community-5')).toBe(false);
    });
  });

  describe('joining', () => {
    it.each([
      {
        name: 'the rejection message',
        rejection: new Error('Community is invite only'),
        expected: 'Community is invite only',
      },
      {
        name: 'a generic message when the rejection carries none',
        rejection: {},
        expected: 'Failed to join community',
      },
    ])('surfaces $name', async ({ rejection, expected }) => {
      await initialise();
      communityService.join.mockRejectedValue(rejection);

      await component.joinCommunity(buildCommunity({ id: 'community-2' }));

      expect(component.error()).toBe(expected);
      expect(component.userMemberships().has('community-2')).toBe(false);
    });

    it('announces the membership change to the rest of the app', async () => {
      await initialise();
      communityService.join.mockResolvedValue({
        id: 'membership-2',
        communityId: 'community-2',
        userId: 'user-1',
        profileId: 'profile-1',
        role: 'member',
        status: 'approved',
        joinedAt: new Date('2026-01-05T00:00:00.000Z'),
      });
      const listener = jest.fn();
      window.addEventListener('ot-community-membership-changed', listener);

      await component.joinCommunity(buildCommunity({ id: 'community-2' }));

      expect(communityService.join).toHaveBeenCalledWith('community-2', {
        communityId: 'community-2',
      });
      expect(listener).toHaveBeenCalledTimes(1);

      window.removeEventListener('ot-community-membership-changed', listener);
    });
  });

  describe('presentation state', () => {
    it.each(['top', 'all'] as const)(
      'switches the display mode to %s',
      (mode) => {
        component.setDisplayMode(mode);

        expect(component.displayMode()).toBe(mode);
      }
    );

    it('breaks a member count tie on activity score', () => {
      component.communities.set([
        buildCommunity({ id: 'community-plain', memberCount: 5 }),
      ]);
      component.topActiveCommunities.set([
        {
          ...buildCommunity({ id: 'community-busy', memberCount: 5 }),
          activityScore: 42,
          postsLast30Days: 4,
          commentsLast30Days: 3,
          votesLast30Days: 2,
          newMembersLast30Days: 1,
        },
      ]);

      expect(component.featuredCommunities().map((entry) => entry.id)).toEqual([
        'community-busy',
        'community-plain',
      ]);
    });

    it('lists a community only once even when both sources return it', () => {
      const shared = buildCommunity({ id: 'community-1', memberCount: 7 });
      component.communities.set([shared]);
      component.topActiveCommunities.set([
        {
          ...shared,
          activityScore: 1,
          postsLast30Days: 0,
          commentsLast30Days: 0,
          votesLast30Days: 0,
          newMembersLast30Days: 0,
        },
      ]);

      expect(component.featuredCommunities()).toHaveLength(1);
    });
  });
});
