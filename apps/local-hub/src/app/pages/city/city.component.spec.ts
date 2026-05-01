import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CityComponent } from './city.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PaymentService } from '../../services/payment.service';
import {
  ClassifiedService,
  ClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';
import { MapComponent } from '../../components/map/map.component';

const communityServiceMock = {
  getCityBySlug: jest.fn().mockResolvedValue({
    id: 'city-1',
    name: 'Savannah',
    slug: 'savannah-ga',
    countryCode: 'US',
    adminArea: 'GA',
    description: 'Coastal city',
    imageUrl: '',
    coordinates: { lat: 32.0809, lng: -81.0912 },
    population: 1,
    timezone: 'America/New_York',
    highlights: [],
    communities: 1,
  }),
  getCommunitiesForCity: jest.fn().mockResolvedValue([
    {
      id: 'city-1',
      name: 'Savannah',
      slug: 'savannah-ga',
      localityType: 'city',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      description: 'Coastal city',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      coordinates: { lat: 32.0809, lng: -81.0912 },
    },
  ]),
  getPostsForRootCommunity: jest.fn().mockResolvedValue([]),
  getCommunityManager: jest.fn().mockResolvedValue(null),
  getActiveElection: jest.fn().mockResolvedValue(null),
};

const authStateMock = {
  isAuthenticated$: { pipe: () => ({ subscribe: jest.fn() }) },
  isAuthenticated: false,
};

const paymentServiceMock = {
  getCityBusinesses: jest.fn().mockResolvedValue([]),
  getDonationGoal: jest.fn().mockResolvedValue({
    raised: 0,
    goal: 0,
    donorCount: 0,
  }),
};

const classifiedServiceMock = {
  findByCommunity: jest.fn().mockResolvedValue({ data: [] as ClassifiedAdDto[] }),
};

describe('CityComponent', () => {
  let fixture: ComponentFixture<CityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CityComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
        { provide: PaymentService, useValue: paymentServiceMock },
        { provide: ClassifiedService, useValue: classifiedServiceMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'savannah-ga' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CityComponent);
    fixture.detectChanges();
  });

  it('uses single-location mode for the city detail map', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const mapComponent = fixture.debugElement.query(
      By.directive(MapComponent)
    )?.componentInstance as MapComponent | undefined;

    expect(mapComponent).toBeDefined();
    expect(mapComponent?.mode).toBe('single-location');
  });
});
