import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FindCommunitiesComponent } from './find-communities.component';
import { CommunityService } from '../services/community.service';
import {
  CommunityJoinPolicy,
  CommunityDto,
} from '@optimistic-tanuki/ui-models';

describe('FindCommunitiesComponent', () => {
  let component: FindCommunitiesComponent;
  let fixture: ComponentFixture<FindCommunitiesComponent>;

  const currentProfile = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Current User',
    profilePic: '',
  };

  const communities: CommunityDto[] = [
    {
      id: 'community-1',
      name: 'Owned Community',
      description: 'A community owned by the current user.',
      ownerId: 'user-1',
      ownerProfileId: 'profile-1',
      appScope: 'social',
      isPrivate: false,
      joinPolicy: CommunityJoinPolicy.PUBLIC,
      tags: [],
      memberCount: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      memberIds: ['profile-1'],
      memberUserIds: ['user-1'],
      ownerIds: ['user-1'],
    },
    {
      id: 'community-2',
      name: 'Open Community',
      description: 'A community not owned by the current user.',
      ownerId: 'other-user',
      ownerProfileId: 'other-profile',
      appScope: 'social',
      isPrivate: false,
      joinPolicy: CommunityJoinPolicy.PUBLIC,
      tags: [],
      memberCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      memberIds: [],
      memberUserIds: [],
      ownerIds: ['other-user'],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FindCommunitiesComponent, RouterTestingModule],
      providers: [
        {
          provide: CommunityService,
          useValue: {
            getCurrentUserProfile: jest.fn().mockResolvedValue(currentProfile),
            findAll: jest.fn().mockResolvedValue(communities),
            getTopActive: jest.fn().mockResolvedValue(communities),
            join: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FindCommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('derives membership and ownership from community dto fields', () => {
    expect(component.currentUserId).toBe('profile-1');
    expect(component.getMembershipStatus('community-1')).toBe('member');
    expect(component.canManage('community-1')).toBe(true);
    expect(component.getMembershipStatus('community-2')).toBe('none');
    expect(component.canManage('community-2')).toBe(false);
  });

  it('does not rely on the legacy user-communities lookup', () => {
    const service = TestBed.inject(CommunityService) as unknown as {
      getUserCommunities?: jest.Mock;
    };

    expect(service.getUserCommunities).toBeUndefined();
  });

  it('surfaces featured communities from available social proof data', () => {
    expect(component.featuredCommunities()).toHaveLength(2);
    expect(component.featuredCommunities()[0].name).toBe('Owned Community');
    expect(fixture.nativeElement.textContent).toContain('Featured communities');
  });

  it('preserves pending membership state after join refreshes community lists', async () => {
    const service = TestBed.inject(CommunityService) as unknown as {
      join: jest.Mock;
    };

    service.join.mockResolvedValue({
      id: 'membership-2',
      communityId: 'community-2',
      userId: 'user-1',
      profileId: 'profile-1',
      role: 'member',
      status: 'pending',
      joinedAt: new Date(),
    });

    await component.joinCommunity(communities[1]);

    expect(component.getMembershipStatus('community-2')).toBe('pending');
  });
});
