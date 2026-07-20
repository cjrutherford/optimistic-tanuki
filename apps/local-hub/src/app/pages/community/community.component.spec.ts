import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommunityComponent } from './community.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { of } from 'rxjs';
import { CommunityPostsComponent } from '@optimistic-tanuki/community-ui';
import { MapComponent } from '../../components/map/map.component';

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
  getUserData: jest.fn().mockReturnValue({
    userId: 'user-1',
    profileId: 'profile-1',
    name: 'Test User',
    email: 'test@example.com',
  }),
  getActingProfileId: jest.fn().mockReturnValue(null),
  logout: jest.fn(),
};

const communityServiceMock = {
  getCommunityBySlug: jest.fn().mockResolvedValue({
    id: '1',
    name: 'Test City',
    slug: 'test-city',
    description: 'A test community',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'TX',
    city: 'Test City',
    coordinates: { lat: 32.0809, lng: -81.0912 },
    joinPolicy: 'public',
    memberCount: 0,
    createdAt: new Date().toISOString(),
  }),
  isMember: jest.fn().mockResolvedValue(false),
  joinCommunity: jest.fn().mockResolvedValue({ status: 'approved' }),
  ensureCommunityChatRoom: jest.fn().mockResolvedValue({ id: 'chat-room-1' }),
  leaveCommunity: jest.fn().mockResolvedValue(undefined),
  getUserRoles: jest.fn().mockResolvedValue([]),
  getCommunityManager: jest.fn().mockResolvedValue(null),
  getActiveElection: jest.fn().mockResolvedValue(null),
  getCitySlugForCommunity: jest.fn().mockResolvedValue('test-city'),
  getLocalitySlugForCommunity: jest.fn().mockResolvedValue('test-city'),
};

const messageServiceMock = {
  addMessage: jest.fn(),
};

const paymentServiceMock = {
  getEligibleOnPageCampaigns: jest.fn().mockResolvedValue([]),
  getBusinessPage: jest.fn().mockResolvedValue(null),
  getDonationGoal: jest.fn().mockResolvedValue({
    raised: 0,
    goal: 0,
    donorCount: 0,
  }),
  createBusinessPage: jest.fn(),
  updateBusinessPage: jest.fn(),
};

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;
  let router: Router;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommunityComponent,
        RouterTestingModule,
        HttpClientTestingModule,
      ],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: PaymentService, useValue: paymentServiceMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'test-city' } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CommunityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears a prior loading error after a community retry succeeds', async () => {
    await fixture.whenStable();
    communityServiceMock.getCommunityBySlug
      .mockRejectedValueOnce(new Error('Temporary API failure'))
      .mockResolvedValueOnce({
        id: '1',
        name: 'Test City',
        slug: 'test-city',
        parentId: null,
        localityType: 'city',
        coordinates: { lat: 32.0809, lng: -81.0912 },
      });

    await component.loadCommunity('test-city');
    expect(component.error()).toBe(
      'Community not found or unable to load. Please try again.'
    );

    await component.loadCommunity('test-city');

    expect(component.error()).toBeNull();
    expect(component.community()?.slug).toBe('test-city');
  });

  it('passes the membership gate into the post composer', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const postsComponent = fixture.debugElement.query(
      By.directive(CommunityPostsComponent)
    )?.componentInstance as CommunityPostsComponent | undefined;

    expect(postsComponent).toBeDefined();
    expect(component.canCompose()).toBe(false);
    expect(postsComponent?.showComposer).toBe(false);
    expect(postsComponent?.canCreatePosts).toBe(false);
  });

  it('uses single-location mode for the community map', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const mapComponent = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;

    expect(mapComponent).toBeDefined();
    expect(mapComponent?.mode).toBe('single-location');
  });

  it('creates a persistent chat room after an approved join', async () => {
    await fixture.whenStable();

    await component.joinCommunity('1');

    expect(communityServiceMock.ensureCommunityChatRoom).toHaveBeenCalledWith(
      '1',
      'user-1',
      'Test City'
    );
    expect(component.isMember()).toBe(true);
  });

  it('repairs the community chat room before opening the chat tab for members', async () => {
    await fixture.whenStable();
    component.isMember.set(true);

    await component.setActiveTab('chat');

    expect(communityServiceMock.ensureCommunityChatRoom).toHaveBeenCalledWith(
      '1',
      'user-1',
      'Test City'
    );
    expect(component.activeTab()).toBe('chat');
  });

  it('navigates community locality links through locality-first routes', async () => {
    await fixture.whenStable();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.navigateToCity();
    await Promise.resolve();

    expect(
      communityServiceMock.getLocalitySlugForCommunity
    ).toHaveBeenCalledWith('test-city');
    expect(navigateSpy).toHaveBeenCalledWith(['/locality', 'test-city']);
  });

  it('uses the locality index when falling back from a community page', async () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.navigateToCities();

    expect(navigateSpy).toHaveBeenCalledWith(['/localities']);
  });

  it('includes anchor coordinates when saving a business profile', async () => {
    await fixture.whenStable();
    component.businessPage.set({
      id: 'business-1',
      communityId: '1',
      userId: 'user-1',
      name: 'Test Business',
      tier: 'pro',
      status: 'active',
      locations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    });
    paymentServiceMock.updateBusinessPage.mockResolvedValue({
      id: 'business-1',
      communityId: '1',
      userId: 'user-1',
      name: 'Updated Business',
      tier: 'pro',
      status: 'active',
      locations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anchorLat: 33.1,
      anchorLng: -84.4,
    });

    component.businessName = 'Updated Business';
    component.businessAnchorLat = '33.1';
    component.businessAnchorLng = '-84.4';

    await component.saveBusinessProfile();

    expect(paymentServiceMock.updateBusinessPage).toHaveBeenCalledWith('1', {
      name: 'Updated Business',
      description: undefined,
      website: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      anchorLat: 33.1,
      anchorLng: -84.4,
    });
  });
});
