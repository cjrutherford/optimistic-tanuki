import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
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

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => this.isAuthenticated.set(auth));

    const slug = this.route.snapshot.paramMap.get('communitySlug') ?? '';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadData(slug, id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(slug: string, id: string): Promise<void> {
    try {
      const [community, ad] = await Promise.all([
        this.communityService.getCommunityBySlug(slug),
        this.classifiedService.findById(id),
      ]);
      this.community.set(community);
      this.ad.set(ad);

      if (this.isAuthenticated()) {
        const myId = this.authState.getActingProfileId();
        this.isOwner.set(
          !!myId && (ad.profileId === myId || ad.userId === myId)
        );
        try {
          this.isMember.set(await this.communityService.isMember(community.id));
        } catch {
          // non-fatal
        }
      }
    } catch {
      this.error.set('Could not load listing. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  navigateToClassifieds(): void {
    const slug = this.community()?.slug;
    if (slug) this.router.navigate(['/c', slug, 'classifieds']);
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
    try {
      const updated = await this.classifiedService.update(ad.id, dto);
      this.ad.set(updated);
      this.showEditForm.set(false);
      this.messageService.addMessage({
        content: 'Listing updated!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to update listing.',
        type: 'error',
      });
    }
  }

  async onMarkSold(): Promise<void> {
    const ad = this.ad();
    if (!ad) return;
    try {
      const updated = await this.classifiedService.markSold(ad.id);
      this.ad.set(updated);
      this.messageService.addMessage({
        content: 'Listing marked as sold.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to update status.',
        type: 'error',
      });
    }
  }

  async onDelete(): Promise<void> {
    const ad = this.ad();
    const slug = this.community()?.slug;
    if (!ad || !slug) return;
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await this.classifiedService.remove(ad.id);
      this.messageService.addMessage({
        content: 'Listing deleted.',
        type: 'success',
      });
      this.router.navigate(['/c', slug, 'classifieds']);
    } catch {
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
      const slug = this.community()?.slug;
      this.messageService.addMessage({
        content: 'Join this community to contact sellers.',
        type: 'info',
      });
      if (slug) this.router.navigate(['/c', slug]);
      return;
    }
    const ad = this.ad();
    if (!ad) return;

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

      let messages = await this.chatService.getMessages(conversation.id);

      if (messages.length === 0) {
        const listingUrl = `${window.location.origin}/c/${this.community()?.slug
          }/classifieds/${ad.id}`;
        const initialMessage = `Classified Ad: "${ad.title}"\nPrice: $${ad.price}\n${listingUrl}\n\nHi! I'm interested in this listing.`;

        await this.chatService.sendMessage({
          conversationId: conversation.id,
          content: initialMessage,
          senderId: myProfileId,
          recipientIds: [sellerProfileId],
          type: 'system',
        });

        messages = await this.chatService.getMessages(conversation.id);
      }

      this.conversationId.set(conversation.id);
      this.chatMessages.set(
        messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }))
      );
      this.showChat.set(true);
    } catch {
      this.messageService.addMessage({
        content: 'Could not open conversation. Please try again.',
        type: 'error',
      });
    } finally {
      this.chatLoading.set(false);
    }
  }

  async sendChatMessage(): Promise<void> {
    const text = this.chatInput().trim();
    const convId = this.conversationId();
    const ad = this.ad();
    if (!text || !convId || !ad) return;

    const myId = this.authState.getActingProfileId();
    const sellerId = ad.profileId || ad.userId;
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
      this.chatMessages.update((msgs) => [
        ...msgs,
        { ...sent, createdAt: new Date(sent.createdAt) },
      ]);
      this.chatInput.set('');
    } catch {
      this.messageService.addMessage({
        content: 'Failed to send message.',
        type: 'error',
      });
    }
  }

  async loadOffers(): Promise<void> {
    const ad = this.ad();
    if (!ad) return;

    this.offersLoading.set(true);
    try {
      const offers = await this.paymentService.getOffersForClassified(ad.id);
      this.offers.set(offers);
      this.showOffersList.set(true);
    } catch {
      this.messageService.addMessage({
        content: 'Failed to load offers.',
        type: 'error',
      });
    } finally {
      this.offersLoading.set(false);
    }
  }

  async onOfferSubmitted(offer: Offer): Promise<void> {
    this.offers.update((offers) => [offer, ...offers]);
  }

  async onAcceptOffer(offer: Offer): Promise<void> {
    try {
      await this.paymentService.acceptOffer(offer.id);
      this.messageService.addMessage({
        content: 'Offer accepted! Payment has been initiated.',
        type: 'success',
      });
      await this.loadOffers();
    } catch {
      this.messageService.addMessage({
        content: 'Failed to accept offer.',
        type: 'error',
      });
    }
  }

  async onRejectOffer(offer: Offer): Promise<void> {
    try {
      await this.paymentService.rejectOffer(offer.id);
      this.messageService.addMessage({
        content: 'Offer rejected.',
        type: 'info',
      });
      await this.loadOffers();
    } catch {
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
    try {
      await this.paymentService.counterOffer(
        data.offer.id,
        data.amount,
        data.message
      );
      this.messageService.addMessage({
        content: 'Counter offer sent!',
        type: 'success',
      });
      await this.loadOffers();
    } catch {
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
}
