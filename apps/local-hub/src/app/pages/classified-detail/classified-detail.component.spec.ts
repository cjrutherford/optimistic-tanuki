import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { ClassifiedService } from '@optimistic-tanuki/classified-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ClassifiedDetailComponent } from './classified-detail.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { AssetService } from '../../services/asset.service';
import { ChatService } from '../../services/chat.service';
import { PaymentService } from '../../services/payment.service';

describe('ClassifiedDetailComponent', () => {
  let fixture: ComponentFixture<ClassifiedDetailComponent>;
  let routeParams: Record<string, string>;
  let routeParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const communityServiceMock = {
    getCommunityBySlug: jest.fn().mockResolvedValue({
      id: 'city-1',
      name: 'Austin',
      slug: 'austin',
      description: 'A city',
      localityType: 'city',
    }),
    isMember: jest.fn().mockResolvedValue(true),
  };
  const classifiedServiceMock = {
    findById: jest.fn().mockResolvedValue({
      id: 'ad-1',
      title: 'Bike',
      description: 'A bike',
      price: 10,
      currency: 'USD',
      status: 'active',
      profileId: 'seller-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageUrls: [],
    }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const authStateMock = {
    isAuthenticated$: new BehaviorSubject(true),
    getActingProfileId: jest.fn().mockReturnValue('buyer-1'),
    getUserData: jest.fn().mockReturnValue({ userId: 'buyer-1' }),
  };

  beforeEach(async () => {
    routeParams = { communitySlug: 'austin', id: 'ad-1' };
    routeParamMap$ = new BehaviorSubject(convertToParamMap(routeParams));
    jest.resetAllMocks();
    communityServiceMock.getCommunityBySlug.mockResolvedValue({
      id: 'city-1',
      name: 'Austin',
      slug: 'austin',
      description: 'A city',
      localityType: 'city',
    });
    communityServiceMock.isMember.mockResolvedValue(true);
    classifiedServiceMock.findById.mockResolvedValue({
      id: 'ad-1',
      title: 'Bike',
      description: 'A bike',
      price: 10,
      currency: 'USD',
      status: 'active',
      profileId: 'seller-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageUrls: [],
    });
    classifiedServiceMock.remove.mockResolvedValue(undefined);
    authStateMock.getActingProfileId.mockReturnValue('buyer-1');
    authStateMock.getUserData.mockReturnValue({ userId: 'buyer-1' });
    await TestBed.configureTestingModule({
      imports: [
        ClassifiedDetailComponent,
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
        { provide: ChatService, useValue: {} },
        {
          provide: MessageService,
          useValue: { addMessage: jest.fn() },
        },
        {
          provide: PaymentService,
          useValue: {
            getOffersForClassified: jest.fn(),
            acceptOffer: jest.fn(),
            rejectOffer: jest.fn(),
            counterOffer: jest.fn(),
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParamMap$.asObservable(),
            snapshot: {
              paramMap: { get: (name: string) => routeParams[name] ?? null },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassifiedDetailComponent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the listing with the city slug and preserves the city back route', async () => {
    routeParams = { slug: 'austin', id: 'ad-1' };
    routeParamMap$.next(convertToParamMap(routeParams));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenLastCalledWith(
      'austin'
    );
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.navigateToClassifieds();

    expect(navigateSpy).toHaveBeenCalledWith([
      '/city',
      'austin',
      'classifieds',
    ]);
  });

  it('keeps community routes on the community base path', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.navigateToClassifieds();

    expect(navigateSpy).toHaveBeenCalledWith(['/c', 'austin', 'classifieds']);
  });

  it('loads the communitySlug route parameter for a detail page', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenLastCalledWith(
      'austin'
    );
  });

  it.each([
    [
      'city',
      { slug: 'austin', id: 'ad-1' },
      ['/city', 'austin', 'classifieds'],
    ],
    [
      'community',
      { communitySlug: 'garden-district', id: 'ad-1' },
      ['/c', 'garden-district', 'classifieds'],
    ],
  ] as const)(
    'preserves the %s route family after deleting a listing',
    async (_family, params, expectedBase) => {
      routeParams = params;
      routeParamMap$.next(convertToParamMap(routeParams));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentInstance.ad.set({ id: 'ad-1' } as any);
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');

      await fixture.componentInstance.onDelete();

      expect(navigateSpy).toHaveBeenCalledWith(expectedBase);
    }
  );

  it.each([
    ['city', { slug: 'austin', id: 'ad-1' }, ['/city', 'austin']],
    [
      'community',
      { communitySlug: 'garden-district', id: 'ad-1' },
      ['/c', 'garden-district'],
    ],
  ] as const)(
    'preserves the %s route family when a non-member contacts a seller',
    async (_family, params, expectedBase) => {
      routeParams = params;
      routeParamMap$.next(convertToParamMap(routeParams));
      communityServiceMock.isMember.mockResolvedValue(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');

      await fixture.componentInstance.onContactSeller();

      expect(navigateSpy).toHaveBeenCalledWith(expectedBase);
    }
  );

  it('reloads the listing when the route id changes and keeps the latest context', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    routeParams = { slug: 'austin', id: 'ad-2' };
    classifiedServiceMock.findById.mockResolvedValueOnce({
      id: 'ad-2',
      title: 'New bike',
      description: 'Another bike',
      price: 20,
      currency: 'USD',
      status: 'active',
      profileId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageUrls: [],
    });
    routeParamMap$.next(convertToParamMap(routeParams));
    await fixture.whenStable();

    expect(classifiedServiceMock.findById).toHaveBeenLastCalledWith('ad-2');
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.navigateToClassifieds();
    expect(navigateSpy).toHaveBeenCalledWith([
      '/city',
      'austin',
      'classifieds',
    ]);
  });

  it('fails safely when a route emission has no slug or listing id', async () => {
    fixture.detectChanges();
    routeParamMap$.next(convertToParamMap({}));
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toContain(
      'determine the requested listing'
    );
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('clears listing-scoped modal, offer, and chat state before a route reload', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const detail = fixture.componentInstance;
    detail.showMakeOfferModal.set(true);
    detail.offers.set([{ id: 'offer-1' } as any]);
    detail.showOffersList.set(true);
    detail.showChat.set(true);
    detail.chatLoading.set(true);
    detail.chatMessages.set([{ id: 'message-1' } as any]);
    detail.chatInput.set('stale message');
    detail.conversationId.set('conversation-1');

    routeParams = { slug: 'austin', id: 'ad-2' };
    classifiedServiceMock.findById.mockResolvedValueOnce({
      id: 'ad-2',
      title: 'New bike',
      description: 'Another bike',
      price: 20,
      currency: 'USD',
      status: 'active',
      profileId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageUrls: [],
    });
    routeParamMap$.next(convertToParamMap(routeParams));

    expect(detail.showMakeOfferModal()).toBe(false);
    expect(detail.offers()).toEqual([]);
    expect(detail.showOffersList()).toBe(false);
    expect(detail.showChat()).toBe(false);
    expect(detail.chatLoading()).toBe(false);
    expect(detail.chatMessages()).toEqual([]);
    expect(detail.chatInput()).toBe('');
    expect(detail.conversationId()).toBeNull();
  });
});
