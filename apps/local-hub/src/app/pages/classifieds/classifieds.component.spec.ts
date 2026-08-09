import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassifiedsComponent } from './classifieds.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { ClassifiedService } from '@optimistic-tanuki/classified-ui';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { AssetService } from '../../services/asset.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

const isAuthenticated$ = new BehaviorSubject(true);

const authStateMock = {
  isAuthenticated$,
  isAuthenticated: true,
  logout: jest.fn(),
  getActingProfileId: jest.fn().mockReturnValue('profile-1'),
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
  let routeParamMap: Record<string, string>;
  let routeData: Record<string, unknown>;
  let routeParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    routeParamMap = { communitySlug: 'test-city' };
    routeData = {};
    routeParamMap$ = new BehaviorSubject(convertToParamMap(routeParamMap));
    jest.resetAllMocks();
    authStateMock.getActingProfileId.mockReturnValue('profile-1');
    communityServiceMock.getCommunityBySlug.mockResolvedValue({
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
    });
    communityServiceMock.isMember.mockResolvedValue(false);
    classifiedServiceMock.findByCommunity.mockResolvedValue([]);
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
            paramMap: routeParamMap$.asObservable(),
            snapshot: {
              paramMap: { get: (name: string) => routeParamMap[name] ?? null },
              data: routeData,
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassifiedsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('hides post actions for signed-in non-members', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.isAuthenticated()).toBe(true);
    expect(component.isMember()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('+ Post Ad');
    expect(fixture.nativeElement.textContent).toContain(
      'Join this community to post ads and contact sellers.'
    );
  });

  it('loads and preserves the city route family', async () => {
    routeParamMap = { slug: 'test-city' };
    routeParamMap$.next(convertToParamMap(routeParamMap));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenLastCalledWith(
      'test-city'
    );

    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    component.navigateToCommunity();
    expect(navigateSpy).toHaveBeenCalledWith(['/city', 'test-city']);
  });

  it('loads a community slug and preserves it for detail navigation', async () => {
    routeParamMap = { communitySlug: 'garden-district' };
    routeParamMap$.next(convertToParamMap(routeParamMap));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenLastCalledWith(
      'garden-district'
    );

    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    component.onViewAd({ id: 'ad-1' } as any);

    expect(navigateSpy).toHaveBeenCalledWith([
      '/c',
      'garden-district',
      'classifieds',
      'ad-1',
    ]);
  });

  it.each([
    ['city', { slug: 'test-city' }, ['/city', 'test-city']],
    [
      'community',
      { communitySlug: 'garden-district' },
      ['/c', 'garden-district'],
    ],
  ] as const)(
    'opens the new-listing form on the %s route family',
    async (_family, params, _base) => {
      routeParamMap = params;
      routeParamMap$.next(convertToParamMap(routeParamMap));
      routeData['openForm'] = true;
      communityServiceMock.isMember.mockResolvedValue(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.showPostForm()).toBe(true);
    }
  );

  it('returns to the locality classifieds route after posting', async () => {
    routeParamMap = { communitySlug: 'garden-district' };
    routeParamMap$.next(convertToParamMap(routeParamMap));
    classifiedServiceMock.create.mockResolvedValue({ id: 'ad-1' });
    fixture.detectChanges();
    await fixture.whenStable();
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');

    await component.onFormSubmit({ title: 'Desk' } as any);

    expect(navigateSpy).toHaveBeenCalledWith([
      '/c',
      'garden-district',
      'classifieds',
    ]);
  });

  it('reloads and updates navigation context when the route params change', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    routeParamMap = { slug: 'city-b' };
    communityServiceMock.getCommunityBySlug.mockResolvedValueOnce({
      ...communityServiceMock.getCommunityBySlug.mock.results[0]?.value,
      id: 'city-b-id',
      slug: 'city-b',
      name: 'City B',
    });
    routeParamMap$.next(convertToParamMap(routeParamMap));
    await fixture.whenStable();

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenLastCalledWith(
      'city-b'
    );
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    component.navigateToCommunity();
    expect(navigateSpy).toHaveBeenCalledWith(['/city', 'city-b']);
  });

  it('fails safely when a route emission has no locality parameter', async () => {
    fixture.detectChanges();
    routeParamMap$.next(convertToParamMap({}));
    await fixture.whenStable();

    expect(component.error()).toContain('determine the requested locality');
    expect(component.loading()).toBe(false);
  });
});
