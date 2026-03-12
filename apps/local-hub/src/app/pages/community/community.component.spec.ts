import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunityComponent } from './community.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
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
    memberCount: 0,
    createdAt: new Date().toISOString(),
  }),
  isMember: jest.fn().mockResolvedValue(false),
  joinCommunity: jest.fn().mockResolvedValue(undefined),
};

const messageServiceMock = {
  addMessage: jest.fn(),
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
