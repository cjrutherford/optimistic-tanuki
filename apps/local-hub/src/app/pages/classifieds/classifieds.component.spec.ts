import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassifiedsComponent } from './classifieds.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { ClassifiedService } from '@optimistic-tanuki/classified-ui';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AssetService } from '../../services/asset.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

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
  findByCommunity: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
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
      ],
      providers: [
        { provide: ClassifiedService, useValue: classifiedServiceMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        {
          provide: AssetService,
          useValue: {
            fileToDataUrl: jest.fn(),
            createAsset: jest.fn(),
            getFileExtension: jest.fn().mockReturnValue('png'),
            getAssetUrl: jest.fn().mockReturnValue('/asset/test'),
          },
        },
        {
          provide: MessageService,
          useValue: { addMessage: jest.fn() },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'test-city' },
              data: {},
            },
          },
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
