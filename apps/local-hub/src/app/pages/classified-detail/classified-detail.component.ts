import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
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
import { CommunityService, LocalCommunity } from '../../services/community.service';
import { AssetService } from '../../services/asset.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-classified-detail',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ClassifiedFormComponent,
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
  private destroy$ = new Subject<void>();

  ad = signal<ClassifiedAdDto | null>(null);
  community = signal<LocalCommunity | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);
  isOwner = signal(false);
  showEditForm = signal(false);

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

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
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
          !!myId &&
            (ad.profileId === myId || ad.userId === myId)
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
      this.messageService.addMessage({ content: 'Listing updated!', type: 'success' });
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
      this.messageService.addMessage({ content: 'Listing marked as sold.', type: 'success' });
    } catch {
      this.messageService.addMessage({ content: 'Failed to update status.', type: 'error' });
    }
  }

  async onDelete(): Promise<void> {
    const ad = this.ad();
    const slug = this.community()?.slug;
    if (!ad || !slug) return;
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await this.classifiedService.remove(ad.id);
      this.messageService.addMessage({ content: 'Listing deleted.', type: 'success' });
      this.router.navigate(['/c', slug, 'classifieds']);
    } catch {
      this.messageService.addMessage({ content: 'Failed to delete listing.', type: 'error' });
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
      const conv = await this.chatService.getOrCreateDirectChat([
        myProfileId,
        sellerProfileId,
      ]);
      this.conversationId.set(conv.id);

      const messages = await this.chatService.getMessages(conv.id);
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
    const recipientIds = [sellerId].filter((id): id is string => !!id && id !== myId);

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
}
