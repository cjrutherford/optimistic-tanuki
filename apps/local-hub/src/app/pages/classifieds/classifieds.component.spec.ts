import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassifiedsComponent } from './classifieds.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ClassifiedService } from '../../services/classified.service';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
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
};

const classifiedServiceMock = {
  getClassifieds: jest.fn().mockResolvedValue([]),
};

describe('ClassifiedsComponent', () => {
  let component: ClassifiedsComponent;
  let fixture: ComponentFixture<ClassifiedsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ClassifiedsComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ClassifiedService, useValue: classifiedServiceMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: API_BASE_URL, useValue: '/api' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'test-city' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassifiedsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
