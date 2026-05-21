import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommunityComponent } from './community.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ActivatedRoute } from '@angular/router';
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
};

const messageServiceMock = {
  addMessage: jest.fn(),
};

const paymentServiceMock = {
  getBusinessPage: jest.fn().mockResolvedValue(null),
  getActiveSponsorships: jest.fn().mockResolvedValue([]),
  getDonationGoal: jest.fn().mockResolvedValue({
    raised: 0,
    goal: 0,
    donorCount: 0,
  }),
  createBusinessPage: jest.fn(),
  updateBusinessPage: jest.fn(),
  createSponsorship: jest.fn(),
};

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;

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

    fixture = TestBed.createComponent(CommunityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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

    const mapComponent = fixture.debugElement.query(
      By.directive(MapComponent)
    )?.componentInstance as MapComponent | undefined;

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
});
