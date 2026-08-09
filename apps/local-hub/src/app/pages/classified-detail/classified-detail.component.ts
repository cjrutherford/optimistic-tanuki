import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ClassifiedFormComponent,
  ClassifiedService,
  ClassifiedAdDto,
  UpdateClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';
import { AuthStateService } from '../../services/auth-state.service';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { AssetService } from '../../services/asset.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PaymentService, Offer } from '../../services/payment.service';
import { MakeOfferModalComponent } from '../../components/make-offer-modal/make-offer-modal.component';
import { OfferListComponent } from '../../components/offer-list/offer-list.component';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  LocalityRouteContext,
  localityRouteContext,
} from '../../utils/locality-route-context';

@Component({
  selector: 'app-classified-detail',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ClassifiedFormComponent,
    MakeOfferModalComponent,
    OfferListComponent,
  ],
  templateUrl: './classified-detail.component.html',
  styleUrls: ['./classified-detail.component.scss'],
})
export class ClassifiedDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private classifiedService = inject(ClassifiedService);
  private communityService = inject(CommunityService);
  private assetService = inject(AssetService);
  private chatService = inject(ChatService);
  readonly authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private paymentService = inject(PaymentService);
  private http = inject(HttpClient);
  private destroy$ = new Subject<void>();

  ad = signal<ClassifiedAdDto | null>(null);
  community = signal<LocalCommunity | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);
  isOwner = signal(false);
  showEditForm = signal(false);

  /** Offer state */
  showMakeOfferModal = signal(false);
  offers = signal<Offer[]>([]);
  offersLoading = signal(false);
  showOffersList = signal(false);

  /** Chat state */
  showChat = signal(false);
  chatLoading = signal(false);
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = signal('');
  conversationId = signal<string | null>(null);
  private routeContext: LocalityRouteContext = {
    slug: '',
    baseSegments: [],
  };
  private loadGeneration = 0;

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => this.isAuthenticated.set(auth));

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const generation = ++this.loadGeneration;
      this.routeContext = localityRouteContext(params);
      const { slug } = this.routeContext;
      const id = params.get('id')?.trim() ?? '';
      this.showMakeOfferModal.set(false);
      this.offers.set([]);
      this.offersLoading.set(false);
      this.showOffersList.set(false);
      this.showChat.set(false);
      this.chatLoading.set(false);
      this.chatMessages.set([]);
      this.chatInput.set('');
      this.conversationId.set(null);
      this.ad.set(null);
      this.community.set(null);
      this.error.set(null);
      this.loading.set(true);
      this.isMember.set(false);
      this.isOwner.set(false);
      this.showEditForm.set(false);

      if (!slug || !id) {
        this.error.set('Could not determine the requested listing.');
        this.loading.set(false);
        return;
      }
      this.loadData(slug, id, generation);
    });
  }

  ngOnDestroy(): void {
    this.loadGeneration++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(
    slug: string,
    id: string,
    generation = this.loadGeneration
  ): Promise<void> {
    try {
      const [community, ad] = await Promise.all([
        this.communityService.getCommunityBySlug(slug),
        this.classifiedService.findById(id),
      ]);
      if (generation !== this.loadGeneration) return;
      this.community.set(community);
      const enrichedAd = await this.enrichSellerProfile(ad);
      if (generation !== this.loadGeneration) return;
      this.ad.set(enrichedAd);

      if (this.isAuthenticated()) {
        const myId = this.authState.getActingProfileId();
        this.isOwner.set(
          !!myId && (ad.profileId === myId || ad.userId === myId)
        );
        try {
          this.isMember.set(await this.communityService.isMember(community.id));
          if (generation !== this.loadGeneration) return;
        } catch {
          // non-fatal
        }
      }
    } catch {
      if (generation === this.loadGeneration) {
        this.error.set('Could not load listing. Please try again.');
      }
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }

  navigateToClassifieds(): void {
    if (this.routeContext.baseSegments.length > 0) {
      this.router.navigate([...this.routeContext.baseSegments, 'classifieds']);
    }
  }

  /** Image upload callback passed to ClassifiedFormComponent */
  uploadImage = async (file: File): Promise<string> => {
    const profileId = this.authState.getActingProfileId();
    const dataUrl = await this.assetService.fileToDataUrl(file);
    const asset = await this.assetService.createAsset({
      name: file.name,
      profileId,
      type: 'image',
      content: dataUrl,
      fileExtension: this.assetService.getFileExtension(dataUrl),
    });
    return this.assetService.getAssetUrl(asset.id);
  };

  async onEditSubmit(dto: UpdateClassifiedAdDto): Promise<void> {
    const ad = this.ad();
    if (!ad) return;
    const generation = this.loadGeneration;
    const listingId = ad.id;
    try {
      const updated = await this.classifiedService.update(ad.id, dto);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.ad.set(updated);
      this.showEditForm.set(false);
      this.messageService.addMessage({
        content: 'Listing updated!',
        type: 'success',
      });
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to update listing.',
        type: 'error',
      });
    }
  }

  async onMarkSold(): Promise<void> {
    const ad = this.ad();
    if (!ad) return;
    const generation = this.loadGeneration;
    const listingId = ad.id;
    try {
      const updated = await this.classifiedService.markSold(ad.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.ad.set(updated);
      this.messageService.addMessage({
        content: 'Listing marked as sold.',
        type: 'success',
      });
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to update status.',
        type: 'error',
      });
    }
  }

  async onDelete(): Promise<void> {
    const ad = this.ad();
    if (!ad || this.routeContext.baseSegments.length === 0) return;
    const generation = this.loadGeneration;
    const listingId = ad.id;
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await this.classifiedService.remove(ad.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Listing deleted.',
        type: 'success',
      });
      this.navigateToClassifieds();
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to delete listing.',
        type: 'error',
      });
    }
  }

  promptSignIn(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  async onContactSeller(): Promise<void> {
    if (!this.isAuthenticated()) {
      this.promptSignIn();
      return;
    }
    if (!this.isMember()) {
      this.messageService.addMessage({
        content: 'Join this community to contact sellers.',
        type: 'info',
      });
      if (this.routeContext.baseSegments.length > 0) {
        this.router.navigate(this.routeContext.baseSegments);
      }
      return;
    }
    const ad = this.ad();
    if (!ad) return;
    const generation = this.loadGeneration;
    const listingId = ad.id;

    const myProfileId = this.authState.getActingProfileId();
    const sellerProfileId = ad.profileId || ad.userId;

    if (!myProfileId || !sellerProfileId || myProfileId === sellerProfileId) {
      this.messageService.addMessage({
        content: "You can't message yourself.",
        type: 'info',
      });
      return;
    }

    this.chatLoading.set(true);
    try {
      let conversation = await this.chatService.getOrCreateDirectChat([
        myProfileId,
        sellerProfileId,
      ]);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;

      let messages = await this.chatService.getMessages(conversation.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;

      if (messages.length === 0) {
        const listingUrl = `${
          window.location.origin
        }${this.routeContext.baseSegments.join('/')}/classifieds/${ad.id}`;
        const initialMessage = `Classified Ad: "${ad.title}"\nPrice: $${ad.price}\n${listingUrl}\n\nHi! I'm interested in this listing.`;

        await this.chatService.sendMessage({
          conversationId: conversation.id,
          content: initialMessage,
          senderId: myProfileId,
          recipientIds: [sellerProfileId],
          type: 'system',
        });
        if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
          return;

        messages = await this.chatService.getMessages(conversation.id);
        if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
          return;
      }

      this.conversationId.set(conversation.id);
      this.chatMessages.set(
        messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }))
      );
      this.showChat.set(true);
    } catch {
      if (generation === this.loadGeneration && this.ad()?.id === listingId) {
        this.messageService.addMessage({
          content: 'Could not open conversation. Please try again.',
          type: 'error',
        });
      }
    } finally {
      if (generation === this.loadGeneration && this.ad()?.id === listingId) {
        this.chatLoading.set(false);
      }
    }
  }

  async sendChatMessage(): Promise<void> {
    const text = this.chatInput().trim();
    const convId = this.conversationId();
    const ad = this.ad();
    if (!text || !convId || !ad) return;

    const myId = this.authState.getActingProfileId();
    const sellerId = ad.profileId || ad.userId;
    const generation = this.loadGeneration;
    const listingId = ad.id;
    const conversationIdentity = convId;
    const recipientIds = [sellerId].filter(
      (id): id is string => !!id && id !== myId
    );

    if (!myId || recipientIds.length === 0) {
      this.messageService.addMessage({
        content: 'Unable to determine message recipient.',
        type: 'error',
      });
      return;
    }

    try {
      const sent = await this.chatService.sendMessage({
        conversationId: convId,
        content: text,
        senderId: myId,
        recipientIds,
      });
      if (
        generation !== this.loadGeneration ||
        this.ad()?.id !== listingId ||
        this.conversationId() !== conversationIdentity
      ) {
        return;
      }
      this.chatMessages.update((msgs) => [
        ...msgs,
        { ...sent, createdAt: new Date(sent.createdAt) },
      ]);
      this.chatInput.set('');
    } catch {
      if (
        generation !== this.loadGeneration ||
        this.ad()?.id !== listingId ||
        this.conversationId() !== conversationIdentity
      ) {
        return;
      }
      this.messageService.addMessage({
        content: 'Failed to send message.',
        type: 'error',
      });
    }
  }

  async loadOffers(): Promise<void> {
    const ad = this.ad();
    if (!ad) return;
    const generation = this.loadGeneration;
    const listingId = ad.id;

    this.offersLoading.set(true);
    try {
      const offers = await this.paymentService.getOffersForClassified(ad.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId) {
        return;
      }
      this.offers.set(offers);
      this.showOffersList.set(true);
    } catch {
      if (generation === this.loadGeneration && this.ad()?.id === listingId) {
        this.messageService.addMessage({
          content: 'Failed to load offers.',
          type: 'error',
        });
      }
    } finally {
      if (generation === this.loadGeneration && this.ad()?.id === listingId) {
        this.offersLoading.set(false);
      }
    }
  }

  async onOfferSubmitted(offer: Offer): Promise<void> {
    this.offers.update((offers) => [offer, ...offers]);
  }

  async onAcceptOffer(offer: Offer): Promise<void> {
    const generation = this.loadGeneration;
    const listingId = this.ad()?.id;
    try {
      await this.paymentService.acceptOffer(offer.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Offer accepted! Payment has been initiated.',
        type: 'success',
      });
      await this.loadOffers();
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to accept offer.',
        type: 'error',
      });
    }
  }

  async onRejectOffer(offer: Offer): Promise<void> {
    const generation = this.loadGeneration;
    const listingId = this.ad()?.id;
    try {
      await this.paymentService.rejectOffer(offer.id);
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Offer rejected.',
        type: 'info',
      });
      await this.loadOffers();
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to reject offer.',
        type: 'error',
      });
    }
  }

  async onCounterOffer(data: {
    offer: Offer;
    amount: number;
    message?: string;
  }): Promise<void> {
    const generation = this.loadGeneration;
    const listingId = this.ad()?.id;
    try {
      await this.paymentService.counterOffer(
        data.offer.id,
        data.amount,
        data.message
      );
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Counter offer sent!',
        type: 'success',
      });
      await this.loadOffers();
    } catch {
      if (generation !== this.loadGeneration || this.ad()?.id !== listingId)
        return;
      this.messageService.addMessage({
        content: 'Failed to send counter offer.',
        type: 'error',
      });
    }
  }

  onMakeOffer(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn();
      return;
    }
    if (!this.isMember()) {
      this.messageService.addMessage({
        content: 'Join this community to make an offer.',
        type: 'info',
      });
      return;
    }
    this.showMakeOfferModal.set(true);
  }

  private async enrichSellerProfile(
    ad: ClassifiedAdDto
  ): Promise<ClassifiedAdDto> {
    if (!ad.profileId) {
      return ad;
    }

    try {
      const profiles = await firstValueFrom(
        this.http.post<ProfileDto[]>('/api/profile/by-ids', {
          ids: [ad.profileId],
        })
      );
      const profile = profiles[0];
      return {
        ...ad,
        sellerProfileName: ad.sellerProfileName || profile?.profileName || null,
        sellerProfilePic: ad.sellerProfilePic || profile?.profilePic || null,
      };
    } catch {
      return ad;
    }
  }
}
