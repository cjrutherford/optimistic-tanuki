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
  let profileServiceMock: Record<string, jest.Mock | (() => unknown)>;

  const mockProfile: ProfileDto = {
    id: '1',
    profileName: 'Test Profile',
    profilePic: 'url/to/profile-pic',
    bio: 'This is a test profile',
    coverPic: 'url/to/cover-pic',
    userId: '231',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
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
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.removeItem('selectedProfile');
    await createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call profileService.selectProfile on init if localStorage has selectedProfile', () => {
    const profileStringified = JSON.stringify(mockProfile);
    localStorage.setItem('selectedProfile', profileStringified);

    TestBed.resetTestingModule();
    return createComponent().then(() => {
      expect(profileService.selectProfile).toHaveBeenCalledWith({
        ...mockProfile,
        created_at: mockProfile.created_at.toISOString(),
      });
      localStorage.removeItem('selectedProfile');
    });
  });

  it('should get the current user profile from the profile service', () => {
    const profile = component.profile;
    expect(profileService.getCurrentUserProfile).toHaveBeenCalled();
    expect(profile).toEqual(mockProfile);
  });
});
