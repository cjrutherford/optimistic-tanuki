import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunityComponent } from './community.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ActivatedRoute } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { of } from 'rxjs';

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
  getUserData: jest.fn().mockReturnValue(null),
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
    joinPolicy: 'public',
    memberCount: 0,
    createdAt: new Date().toISOString(),
  }),
  isMember: jest.fn().mockResolvedValue(false),
  joinCommunity: jest.fn().mockResolvedValue({ status: 'approved' }),
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
  createBusinessPage: jest.fn(),
  updateBusinessPage: jest.fn(),
  createSponsorship: jest.fn(),
};

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;

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
});
