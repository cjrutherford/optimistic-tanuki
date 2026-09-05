import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  ClassifiedAdDto,
  ClassifiedService,
} from '@optimistic-tanuki/classified-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ClassifiedDetailComponent } from './classified-detail.component';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { AssetService } from '../../services/asset.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { Offer, PaymentService } from '../../services/payment.service';

/**
 * Mocks are declared with named interfaces rather than an index signature so
 * that member access stays legal under `noPropertyAccessFromIndexSignature`.
 */
interface CommunityServiceMock {
  getCommunityBySlug: jest.Mock;
  isMember: jest.Mock;
}
interface ClassifiedServiceMock {
  findById: jest.Mock;
  update: jest.Mock;
  markSold: jest.Mock;
  remove: jest.Mock;
}
interface AuthStateMock {
  isAuthenticated$: BehaviorSubject<boolean>;
  getActingProfileId: jest.Mock;
  getUserData: jest.Mock;
}
interface ChatServiceMock {
  getOrCreateDirectChat: jest.Mock;
  getMessages: jest.Mock;
  sendMessage: jest.Mock;
}
interface AssetServiceMock {
  fileToDataUrl: jest.Mock;
  createAsset: jest.Mock;
  getFileExtension: jest.Mock;
  getAssetUrl: jest.Mock;
}
interface MessageServiceMock {
  addMessage: jest.Mock;
}
interface PaymentServiceMock {
  getOffersForClassified: jest.Mock;
  acceptOffer: jest.Mock;
  rejectOffer: jest.Mock;
  counterOffer: jest.Mock;
}

const PROFILE_LOOKUP_URL = '/api/profile/by-ids';

const community: LocalCommunity = {
  id: 'city-1',
  name: 'Austin',
  slug: 'austin',
  description: 'A city',
  localityType: 'city',
} as LocalCommunity;

function makeAd(overrides: Partial<ClassifiedAdDto> = {}): ClassifiedAdDto {
  return {
    id: 'ad-1',
    communityId: 'city-1',
    profileId: 'seller-1',
    userId: 'seller-user-1',
    title: 'Bike',
    description: 'A bike',
    price: 120,
    currency: 'USD',
    category: null,
    condition: null,
    imageUrls: [],
    status: 'active',
    isFeatured: false,
    featuredUntil: null,
    appScope: 'local-hub',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    classifiedId: 'ad-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    offeredAmount: 100,
    status: 'pending',
    expiresAt: '2024-02-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderId: 'buyer-1',
    content: 'Hello',
    type: 'chat',
    recipients: ['seller-1'],
    createdAt: '2024-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('ClassifiedDetailComponent behaviour', () => {
  let fixture: ComponentFixture<ClassifiedDetailComponent>;
  let component: ClassifiedDetailComponent;
  let http: HttpTestingController;
  let router: Router;
  let navigateSpy: jest.SpyInstance;
  let routeParams: Record<string, string>;
  let routeParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  let communityServiceMock: CommunityServiceMock;
  let classifiedServiceMock: ClassifiedServiceMock;
  let authStateMock: AuthStateMock;
  let chatServiceMock: ChatServiceMock;
  let assetServiceMock: AssetServiceMock;
  let messageServiceMock: MessageServiceMock;
  let paymentServiceMock: PaymentServiceMock;

  beforeEach(async () => {
    routeParams = { slug: 'austin', id: 'ad-1' };
    routeParamMap$ = new BehaviorSubject(convertToParamMap(routeParams));

    communityServiceMock = {
      getCommunityBySlug: jest.fn().mockResolvedValue(community),
      isMember: jest.fn().mockResolvedValue(true),
    };
    classifiedServiceMock = {
      findById: jest.fn().mockResolvedValue(makeAd()),
      update: jest.fn(),
      markSold: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    authStateMock = {
      isAuthenticated$: new BehaviorSubject(true),
      getActingProfileId: jest.fn().mockReturnValue('buyer-1'),
      getUserData: jest.fn().mockReturnValue({ userId: 'buyer-1' }),
    };
    chatServiceMock = {
      getOrCreateDirectChat: jest.fn(),
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
    };
    assetServiceMock = {
      fileToDataUrl: jest.fn(),
      createAsset: jest.fn(),
      getFileExtension: jest.fn().mockReturnValue('png'),
      getAssetUrl: jest.fn().mockReturnValue('/api/asset/asset-1'),
    };
    messageServiceMock = { addMessage: jest.fn() };
    paymentServiceMock = {
      getOffersForClassified: jest.fn().mockResolvedValue([]),
      acceptOffer: jest.fn(),
      rejectOffer: jest.fn(),
      counterOffer: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ClassifiedDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ClassifiedService, useValue: classifiedServiceMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: AssetService, useValue: assetServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: PaymentService, useValue: paymentServiceMock },
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
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  /**
   * `enrichSellerProfile` posts to the profile lookup whenever the loaded ad
   * carries a profileId, and `loadData` stays suspended until that request is
   * answered — so the harness has to answer it before the load can settle.
   */
  async function settleLoad(
    profiles: Partial<ProfileDto>[] = [],
    lookupFails = false
  ): Promise<void> {
    await fixture.whenStable();
    for (const request of http.match(PROFILE_LOOKUP_URL)) {
      if (lookupFails) {
        request.error(new ProgressEvent('network error'));
      } else {
        request.flush(profiles);
      }
    }
    await fixture.whenStable();
  }

  /** Boots the component and drains the initial load. */
  async function boot(profiles: Partial<ProfileDto>[] = []): Promise<void> {
    fixture.detectChanges();
    await settleLoad(profiles);
    fixture.detectChanges();
  }

  describe('initial load', () => {
    it('publishes the community and the enriched ad, then stops loading', async () => {
      await boot([{ profileName: 'Alice', profilePic: '/alice.png' }]);

      expect(component.community()).toEqual(community);
      expect(component.ad()?.sellerProfileName).toBe('Alice');
      expect(component.ad()?.sellerProfilePic).toBe('/alice.png');
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('asks the profile service for exactly the ad seller profile id', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const request = http.expectOne(PROFILE_LOOKUP_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ ids: ['seller-1'] });
      request.flush([]);
      await fixture.whenStable();
    });

    it('surfaces an error message when the listing cannot be fetched', async () => {
      classifiedServiceMock.findById.mockRejectedValue(new Error('boom'));

      await boot();

      expect(component.error()).toBe(
        'Could not load listing. Please try again.'
      );
      expect(component.ad()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('treats a failed membership check as non-fatal', async () => {
      communityServiceMock.isMember.mockRejectedValue(new Error('nope'));

      await boot();

      expect(component.isMember()).toBe(false);
      expect(component.error()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('skips the membership check entirely for anonymous visitors', async () => {
      authStateMock.isAuthenticated$.next(false);

      await boot();

      expect(communityServiceMock.isMember).not.toHaveBeenCalled();
      expect(component.isOwner()).toBe(false);
    });

    it.each([
      ['the acting profile matches ad.profileId', 'seller-1', true],
      ['the acting profile matches ad.userId', 'seller-user-1', true],
      ['the acting profile matches neither id', 'buyer-1', false],
      ['there is no acting profile at all', null, false],
    ])(
      'marks ownership false/true when %s',
      async (_case, actingId, expected) => {
        authStateMock.getActingProfileId.mockReturnValue(actingId);

        await boot();

        expect(component.isOwner()).toBe(expected);
      }
    );

    it('stops the reload of a superseded route emission from overwriting state', async () => {
      await boot();
      // Hold the second load open so a third emission can overtake it.
      let releaseFind: (ad: ClassifiedAdDto) => void = () => undefined;
      classifiedServiceMock.findById.mockImplementationOnce(
        () => new Promise<ClassifiedAdDto>((resolve) => (releaseFind = resolve))
      );
      routeParamMap$.next(convertToParamMap({ slug: 'austin', id: 'ad-2' }));
      await fixture.whenStable();

      classifiedServiceMock.findById.mockResolvedValue(
        makeAd({ id: 'ad-3', profileId: '' })
      );
      routeParamMap$.next(convertToParamMap({ slug: 'austin', id: 'ad-3' }));
      await settleLoad();

      releaseFind(makeAd({ id: 'ad-2', profileId: '' }));
      await settleLoad();

      expect(component.ad()?.id).toBe('ad-3');
    });
  });

  describe('seller profile enrichment', () => {
    it('leaves the ad untouched and issues no lookup when it has no profileId', async () => {
      classifiedServiceMock.findById.mockResolvedValue(
        makeAd({ profileId: '', sellerProfileName: null })
      );

      fixture.detectChanges();
      await fixture.whenStable();

      expect(http.match(PROFILE_LOOKUP_URL)).toHaveLength(0);
      expect(component.ad()?.id).toBe('ad-1');
      expect(component.ad()?.sellerProfileName).toBeNull();
    });

    it('falls back to the unenriched ad when the lookup fails', async () => {
      fixture.detectChanges();
      await settleLoad([], true);

      expect(component.ad()?.id).toBe('ad-1');
      expect(component.ad()?.sellerProfileName).toBeUndefined();
      expect(component.error()).toBeNull();
    });

    it('prefers seller details already present on the ad', async () => {
      classifiedServiceMock.findById.mockResolvedValue(
        makeAd({
          sellerProfileName: 'From ad',
          sellerProfilePic: '/from-ad.png',
        })
      );

      await boot([{ profileName: 'From lookup', profilePic: '/lookup.png' }]);

      expect(component.ad()?.sellerProfileName).toBe('From ad');
      expect(component.ad()?.sellerProfilePic).toBe('/from-ad.png');
    });

    it('nulls out seller details when the lookup returns no profile', async () => {
      await boot([]);

      expect(component.ad()?.sellerProfileName).toBeNull();
      expect(component.ad()?.sellerProfilePic).toBeNull();
    });
  });

  describe('image upload callback', () => {
    it('stores the file as an asset and returns its url', async () => {
      assetServiceMock.fileToDataUrl.mockResolvedValue(
        'data:image/png;base64,AAA'
      );
      assetServiceMock.createAsset.mockResolvedValue({ id: 'asset-1' });
      await boot();

      const file = new File(['x'], 'bike.png', { type: 'image/png' });
      const url = await component.uploadImage(file);

      expect(assetServiceMock.fileToDataUrl).toHaveBeenCalledWith(file);
      expect(assetServiceMock.createAsset).toHaveBeenCalledWith({
        name: 'bike.png',
        profileId: 'buyer-1',
        type: 'image',
        content: 'data:image/png;base64,AAA',
        fileExtension: 'png',
      });
      expect(url).toBe('/api/asset/asset-1');
    });
  });

  describe('owner listing actions', () => {
    it('applies an edit, closes the form and reports success', async () => {
      const updated = makeAd({ title: 'Updated bike' });
      classifiedServiceMock.update.mockResolvedValue(updated);
      await boot();
      component.showEditForm.set(true);

      await component.onEditSubmit({ title: 'Updated bike' });

      expect(classifiedServiceMock.update).toHaveBeenCalledWith('ad-1', {
        title: 'Updated bike',
      });
      expect(component.ad()).toEqual(updated);
      expect(component.showEditForm()).toBe(false);
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Listing updated!',
        type: 'success',
      });
    });

    it('reports a failed edit and keeps the form open', async () => {
      classifiedServiceMock.update.mockRejectedValue(new Error('boom'));
      await boot();
      component.showEditForm.set(true);

      await component.onEditSubmit({ title: 'Updated bike' });

      expect(component.showEditForm()).toBe(true);
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to update listing.',
        type: 'error',
      });
    });

    it('ignores an edit result that lands after the listing has changed', async () => {
      let releaseUpdate: (ad: ClassifiedAdDto) => void = () => undefined;
      classifiedServiceMock.update.mockImplementation(
        () =>
          new Promise<ClassifiedAdDto>((resolve) => (releaseUpdate = resolve))
      );
      await boot();

      const pending = component.onEditSubmit({ title: 'Updated bike' });
      // The visitor navigates to a different listing mid-flight.
      component.ad.set(makeAd({ id: 'ad-9' }));
      releaseUpdate(makeAd({ title: 'Updated bike' }));
      await pending;

      expect(component.ad()?.id).toBe('ad-9');
      expect(messageServiceMock.addMessage).not.toHaveBeenCalled();
    });

    it('does nothing when there is no loaded ad to edit', async () => {
      await boot();
      component.ad.set(null);

      await component.onEditSubmit({ title: 'Updated bike' });

      expect(classifiedServiceMock.update).not.toHaveBeenCalled();
    });

    it('marks the listing sold and swaps in the returned ad', async () => {
      const sold = makeAd({ status: 'sold' });
      classifiedServiceMock.markSold.mockResolvedValue(sold);
      await boot();

      await component.onMarkSold();

      expect(classifiedServiceMock.markSold).toHaveBeenCalledWith('ad-1');
      expect(component.ad()?.status).toBe('sold');
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Listing marked as sold.',
        type: 'success',
      });
    });

    it('reports a failed mark-sold and leaves the status alone', async () => {
      classifiedServiceMock.markSold.mockRejectedValue(new Error('boom'));
      await boot();

      await component.onMarkSold();

      expect(component.ad()?.status).toBe('active');
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to update status.',
        type: 'error',
      });
    });

    it('does nothing when there is no loaded ad to mark sold', async () => {
      await boot();
      component.ad.set(null);

      await component.onMarkSold();

      expect(classifiedServiceMock.markSold).not.toHaveBeenCalled();
    });

    it('aborts the delete when the confirm dialog is dismissed', async () => {
      await boot();
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      await component.onDelete();

      expect(classifiedServiceMock.remove).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('reports a failed delete and stays on the listing', async () => {
      classifiedServiceMock.remove.mockRejectedValue(new Error('boom'));
      await boot();
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      await component.onDelete();

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to delete listing.',
        type: 'error',
      });
    });

    it('does not delete when the route carries no locality segments', async () => {
      routeParamMap$.next(convertToParamMap({ id: 'ad-1' }));
      fixture.detectChanges();
      await fixture.whenStable();
      component.ad.set(makeAd());
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      await component.onDelete();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(classifiedServiceMock.remove).not.toHaveBeenCalled();
    });
  });

  describe('sign-in prompt', () => {
    it('routes to login carrying the current url as the return target', async () => {
      await boot();

      component.promptSignIn();

      expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: router.url },
      });
    });
  });

  describe('contacting the seller', () => {
    it('prompts anonymous visitors to sign in instead of opening a chat', async () => {
      authStateMock.isAuthenticated$.next(false);
      await boot();

      await component.onContactSeller();

      expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: router.url },
      });
      expect(chatServiceMock.getOrCreateDirectChat).not.toHaveBeenCalled();
    });

    it('refuses to open a conversation with yourself', async () => {
      authStateMock.getActingProfileId.mockReturnValue('seller-1');
      await boot();

      await component.onContactSeller();

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: "You can't message yourself.",
        type: 'info',
      });
      expect(chatServiceMock.getOrCreateDirectChat).not.toHaveBeenCalled();
    });

    it('refuses to open a conversation when the acting profile is unknown', async () => {
      await boot();
      authStateMock.getActingProfileId.mockReturnValue(null);

      await component.onContactSeller();

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: "You can't message yourself.",
        type: 'info',
      });
      expect(chatServiceMock.getOrCreateDirectChat).not.toHaveBeenCalled();
    });

    it('opens an existing conversation without seeding an intro message', async () => {
      chatServiceMock.getOrCreateDirectChat.mockResolvedValue({
        id: 'conversation-1',
      });
      chatServiceMock.getMessages.mockResolvedValue([makeChatMessage()]);
      await boot();

      await component.onContactSeller();

      expect(chatServiceMock.getOrCreateDirectChat).toHaveBeenCalledWith([
        'buyer-1',
        'seller-1',
      ]);
      expect(chatServiceMock.sendMessage).not.toHaveBeenCalled();
      expect(component.conversationId()).toBe('conversation-1');
      expect(component.showChat()).toBe(true);
      expect(component.chatLoading()).toBe(false);
      // Timestamps are normalised to Date objects for the template's date pipe.
      expect(component.chatMessages()[0].createdAt).toEqual(
        new Date('2024-01-02T00:00:00.000Z')
      );
    });

    it('seeds an intro message quoting the listing when the chat is empty', async () => {
      chatServiceMock.getOrCreateDirectChat.mockResolvedValue({
        id: 'conversation-1',
      });
      chatServiceMock.getMessages
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeChatMessage({ type: 'system' })]);
      chatServiceMock.sendMessage.mockResolvedValue(makeChatMessage());
      await boot();

      await component.onContactSeller();

      expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        content: expect.stringContaining(
          `${window.location.origin}/city/austin/classifieds/ad-1`
        ),
        senderId: 'buyer-1',
        recipientIds: ['seller-1'],
        type: 'system',
      });
      const seeded = chatServiceMock.sendMessage.mock.calls[0][0].content;
      expect(seeded).toContain('Classified Ad: "Bike"');
      expect(seeded).toContain('Price: $120');
      expect(chatServiceMock.getMessages).toHaveBeenCalledTimes(2);
      expect(component.chatMessages()).toHaveLength(1);
    });

    it('reports a chat that could not be opened and clears the loading flag', async () => {
      chatServiceMock.getOrCreateDirectChat.mockRejectedValue(
        new Error('boom')
      );
      await boot();

      await component.onContactSeller();

      expect(component.showChat()).toBe(false);
      expect(component.chatLoading()).toBe(false);
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Could not open conversation. Please try again.',
        type: 'error',
      });
    });

    it('does nothing when no ad is loaded', async () => {
      await boot();
      component.ad.set(null);

      await component.onContactSeller();

      expect(chatServiceMock.getOrCreateDirectChat).not.toHaveBeenCalled();
      expect(component.chatLoading()).toBe(false);
    });
  });

  describe('sending a chat message', () => {
    beforeEach(async () => {
      await boot();
      component.conversationId.set('conversation-1');
      component.chatInput.set('Is it still available?');
    });

    it('sends the trimmed text to the seller and clears the composer', async () => {
      const sent = makeChatMessage({
        id: 'message-2',
        content: 'Is it still available?',
      });
      chatServiceMock.sendMessage.mockResolvedValue(sent);
      component.chatInput.set('  Is it still available?  ');

      await component.sendChatMessage();

      expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        content: 'Is it still available?',
        senderId: 'buyer-1',
        recipientIds: ['seller-1'],
      });
      expect(component.chatMessages()).toHaveLength(1);
      expect(component.chatMessages()[0].createdAt).toEqual(
        new Date('2024-01-02T00:00:00.000Z')
      );
      expect(component.chatInput()).toBe('');
    });

    it('reports a send failure and keeps the draft text', async () => {
      chatServiceMock.sendMessage.mockRejectedValue(new Error('boom'));

      await component.sendChatMessage();

      expect(component.chatMessages()).toEqual([]);
      expect(component.chatInput()).toBe('Is it still available?');
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to send message.',
        type: 'error',
      });
    });

    it.each([
      ['the composer is blank', () => component.chatInput.set('   ')],
      ['no conversation is open', () => component.conversationId.set(null)],
      ['no ad is loaded', () => component.ad.set(null)],
    ])('does not send when %s', async (_case, arrange) => {
      arrange();

      await component.sendChatMessage();

      expect(chatServiceMock.sendMessage).not.toHaveBeenCalled();
      expect(messageServiceMock.addMessage).not.toHaveBeenCalled();
    });

    it('refuses to send when the only recipient would be the sender', async () => {
      authStateMock.getActingProfileId.mockReturnValue('seller-1');

      await component.sendChatMessage();

      expect(chatServiceMock.sendMessage).not.toHaveBeenCalled();
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Unable to determine message recipient.',
        type: 'error',
      });
    });

    it('refuses to send when the acting profile is unknown', async () => {
      authStateMock.getActingProfileId.mockReturnValue(null);

      await component.sendChatMessage();

      expect(chatServiceMock.sendMessage).not.toHaveBeenCalled();
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Unable to determine message recipient.',
        type: 'error',
      });
    });
  });

  describe('offers', () => {
    it('loads offers for the current listing and opens the list', async () => {
      const offers = [makeOffer()];
      paymentServiceMock.getOffersForClassified.mockResolvedValue(offers);
      await boot();

      await component.loadOffers();

      expect(paymentServiceMock.getOffersForClassified).toHaveBeenCalledWith(
        'ad-1'
      );
      expect(component.offers()).toEqual(offers);
      expect(component.showOffersList()).toBe(true);
      expect(component.offersLoading()).toBe(false);
    });

    it('reports a failed offer load and leaves the list closed', async () => {
      paymentServiceMock.getOffersForClassified.mockRejectedValue(
        new Error('boom')
      );
      await boot();

      await component.loadOffers();

      expect(component.showOffersList()).toBe(false);
      expect(component.offersLoading()).toBe(false);
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to load offers.',
        type: 'error',
      });
    });

    it('does not load offers when no ad is present', async () => {
      await boot();
      component.ad.set(null);

      await component.loadOffers();

      expect(paymentServiceMock.getOffersForClassified).not.toHaveBeenCalled();
      expect(component.offersLoading()).toBe(false);
    });

    it('puts a newly submitted offer at the head of the list', async () => {
      await boot();
      const existing = makeOffer({ id: 'offer-old' });
      component.offers.set([existing]);
      const fresh = makeOffer({ id: 'offer-new' });

      await component.onOfferSubmitted(fresh);

      expect(component.offers().map((o) => o.id)).toEqual([
        'offer-new',
        'offer-old',
      ]);
    });

    it.each([
      [
        'accept',
        (offer: Offer) => component.onAcceptOffer(offer),
        () => paymentServiceMock.acceptOffer,
        {
          content: 'Offer accepted! Payment has been initiated.',
          type: 'success',
        },
      ],
      [
        'reject',
        (offer: Offer) => component.onRejectOffer(offer),
        () => paymentServiceMock.rejectOffer,
        { content: 'Offer rejected.', type: 'info' },
      ],
    ] as const)(
      'refreshes the offer list after a successful %s',
      async (_action, invoke, serviceFn, successMessage) => {
        await boot();
        serviceFn().mockResolvedValue(makeOffer());
        paymentServiceMock.getOffersForClassified.mockResolvedValue([
          makeOffer({ id: 'offer-refreshed' }),
        ]);

        await invoke(makeOffer());

        expect(serviceFn()).toHaveBeenCalledWith('offer-1');
        expect(messageServiceMock.addMessage).toHaveBeenCalledWith(
          successMessage
        );
        expect(component.offers().map((o) => o.id)).toEqual([
          'offer-refreshed',
        ]);
      }
    );

    it.each([
      [
        'accept',
        (offer: Offer) => component.onAcceptOffer(offer),
        () => paymentServiceMock.acceptOffer,
        { content: 'Failed to accept offer.', type: 'error' },
      ],
      [
        'reject',
        (offer: Offer) => component.onRejectOffer(offer),
        () => paymentServiceMock.rejectOffer,
        { content: 'Failed to reject offer.', type: 'error' },
      ],
    ] as const)(
      'reports a failed %s and does not refresh the list',
      async (_action, invoke, serviceFn, errorMessage) => {
        await boot();
        serviceFn().mockRejectedValue(new Error('boom'));

        await invoke(makeOffer());

        expect(messageServiceMock.addMessage).toHaveBeenCalledWith(
          errorMessage
        );
        expect(
          paymentServiceMock.getOffersForClassified
        ).not.toHaveBeenCalled();
      }
    );

    it('sends a counter offer with the amount and message, then refreshes', async () => {
      await boot();
      paymentServiceMock.counterOffer.mockResolvedValue(makeOffer());
      paymentServiceMock.getOffersForClassified.mockResolvedValue([
        makeOffer({ id: 'offer-countered' }),
      ]);

      await component.onCounterOffer({
        offer: makeOffer(),
        amount: 90,
        message: 'Would you take 90?',
      });

      expect(paymentServiceMock.counterOffer).toHaveBeenCalledWith(
        'offer-1',
        90,
        'Would you take 90?'
      );
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Counter offer sent!',
        type: 'success',
      });
      expect(component.offers().map((o) => o.id)).toEqual(['offer-countered']);
    });

    it('reports a failed counter offer', async () => {
      await boot();
      paymentServiceMock.counterOffer.mockRejectedValue(new Error('boom'));

      await component.onCounterOffer({ offer: makeOffer(), amount: 90 });

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Failed to send counter offer.',
        type: 'error',
      });
      expect(paymentServiceMock.getOffersForClassified).not.toHaveBeenCalled();
    });

    it('prompts anonymous visitors to sign in rather than opening the offer modal', async () => {
      authStateMock.isAuthenticated$.next(false);
      await boot();

      component.onMakeOffer();

      expect(component.showMakeOfferModal()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: router.url },
      });
    });

    it('asks signed-in non-members to join before making an offer', async () => {
      communityServiceMock.isMember.mockResolvedValue(false);
      await boot();

      component.onMakeOffer();

      expect(component.showMakeOfferModal()).toBe(false);
      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'Join this community to make an offer.',
        type: 'info',
      });
    });

    it('opens the offer modal for signed-in members', async () => {
      await boot();

      component.onMakeOffer();

      expect(component.showMakeOfferModal()).toBe(true);
    });
  });

  describe('teardown', () => {
    it('stops reacting to route emissions once destroyed', async () => {
      await boot();
      classifiedServiceMock.findById.mockClear();

      fixture.destroy();
      routeParamMap$.next(convertToParamMap({ slug: 'austin', id: 'ad-2' }));

      expect(classifiedServiceMock.findById).not.toHaveBeenCalled();
    });
  });
});
