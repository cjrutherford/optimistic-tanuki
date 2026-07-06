import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { ProfileService } from '../profile.service';
import { of } from 'rxjs';
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

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: ProfileService;
  let router: Router;
  let profileServiceMock: Record<string, jest.Mock | (() => unknown)>;

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
      getBlockedUsers: jest.fn().mockReturnValue(of([])),
      blockUser: jest.fn().mockReturnValue(of(undefined)),
      unblockUser: jest.fn().mockReturnValue(of(undefined)),
      ...profileOverrides,
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, RouterTestingModule],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
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

  it('does not fetch blocked users when loading another profile', async () => {
    TestBed.resetTestingModule();

    await createComponent(
      { userId: 'other-profile' },
      {
        getDisplayProfile: jest
          .fn()
          .mockReturnValue(of({ ...mockProfile, id: 'other-profile' })),
      }
    );

    expect(profileService.getBlockedUsers).not.toHaveBeenCalled();
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
