import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  LocalCommunity,
  CommunityManager,
  CommunityElection,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { MapComponent } from '../../components/map/map.component';
import { SponsorshipBannerComponent } from '../../components/sponsorship-banner/sponsorship-banner.component';
import {
  PaymentService,
  BusinessPage,
  CommunitySponsorship,
} from '../../services/payment.service';
import { DonationProgressComponent } from '../../components/donation-progress/donation-progress.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import {
  CommunityPostsComponent,
  CommunityChatComponent,
  ManageMembersComponent,
} from '@optimistic-tanuki/community-ui';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MapComponent,
    CommunityPostsComponent,
    CommunityChatComponent,
    ManageMembersComponent,
    SponsorshipBannerComponent,
    DonationProgressComponent,
    ModalComponent,
  ],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  readonly authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private paymentService = inject(PaymentService);
  private destroy$ = new Subject<void>();

  community = signal<LocalCommunity | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isMember = signal(false);
  isAuthenticated = signal(false);
  joiningInProgress = signal(false);
  loadingBusiness = signal(false);
  businessCheckoutInProgress = signal(false);
  savingBusinessProfile = signal(false);
  sponsorshipCheckoutInProgress = signal(false);
  businessPage = signal<BusinessPage | null>(null);
  activeSponsorships = signal<CommunitySponsorship[]>([]);
  selectedBusinessTier = signal<'basic' | 'pro' | 'enterprise'>('basic');
  selectedSponsorshipType = signal<'sticky-ad' | 'banner' | 'featured'>(
    'banner'
  );

  /** Elected manager for this locality (only set when community is a locality). */
  communityManager = signal<CommunityManager | null>(null);
  /** Active election for this locality, if any. */
  activeElection = signal<CommunityElection | null>(null);
  votingInProgress = signal(false);

  showBusinessModal = signal(false);
  showSponsorshipModal = signal(false);
  showElectionModal = signal(false);

  businessName = '';
  businessDescription = '';
  businessWebsite = '';
  businessPhone = '';
  businessEmail = '';
  businessAddress = '';
  sponsorshipAdContent = '';

  /**
   * True when this community is a root locality (city/town/neighborhood with
   * no parent).  Localities are system-managed; sub-communities are user-created.
   */
  get isLocality(): boolean {
    const c = this.community();
    return !!c && !c.parentId;
  }

  async ngOnInit(): Promise<void> {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => {
        this.isAuthenticated.set(auth);
      });

    const slug = this.route.snapshot.paramMap.get('communitySlug') ?? '';
    await this.loadCommunity(slug);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Elections ────────────────────────────────────────────────────────────────

  openElectionModal(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('election');
      return;
    }
    this.showElectionModal.set(true);
  }

  async selfNominate(): Promise<void> {
    const community = this.community();
    if (!community) return;
    try {
      await this.communityService.nominateForManager(community.id);
      const election = await this.communityService.getActiveElection(
        community.id
      );
      this.activeElection.set(election);
      this.messageService.addMessage({
        content: 'You have been nominated as a candidate!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Nomination failed. Please try again.',
        type: 'error',
      });
    }
  }

  async voteForCandidate(candidateUserId: string): Promise<void> {
    const community = this.community();
    if (!community) return;
    this.votingInProgress.set(true);
    try {
      const updated = await this.communityService.voteForManager(
        community.id,
        candidateUserId
      );
      this.activeElection.set(updated);
      this.messageService.addMessage({
        content: 'Your vote has been recorded!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to cast vote. Please try again.',
        type: 'error',
      });
    } finally {
      this.votingInProgress.set(false);
    }
  }

  async loadCommunity(slug: string): Promise<void> {
    try {
      const data = await this.communityService.getCommunityBySlug(slug);

      if (!data) {
        this.error.set(
          'Community not found or unable to load. Please try again.'
        );
      } else {
        this.community.set(data);

        // Use synchronous auth check to avoid API call when not logged in
        if (this.authState.isAuthenticated) {
          try {
            const member = await this.communityService.isMember(data.id);
            this.isMember.set(member);
          } catch {
            // membership check failing is non-fatal
          }

          await this.loadBusinessSupportData(data.id);
        }

        // Load manager & election info for localities (non-fatal)
        if (!data.parentId) {
          const [manager, election] = await Promise.all([
            this.communityService.getCommunityManager(data.id),
            this.communityService.getActiveElection(data.id),
          ]);
          this.communityManager.set(manager);
          this.activeElection.set(election);
        }
      }
    } catch {
      this.error.set(
        'Community not found or unable to load. Please try again.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadBusinessSupportData(communityId: string): Promise<void> {
    this.loadingBusiness.set(true);
    try {
      const [businessPage, sponsorships] = await Promise.all([
        this.paymentService.getBusinessPage(communityId),
        this.paymentService.getActiveSponsorships(communityId),
      ]);

      this.businessPage.set(businessPage);
      this.activeSponsorships.set(sponsorships);

      if (businessPage) {
        this.businessName = businessPage.name || '';
        this.businessDescription = businessPage.description || '';
        this.businessWebsite = businessPage.website || '';
        this.businessPhone = businessPage.phone || '';
        this.businessEmail = businessPage.email || '';
        this.businessAddress = businessPage.address || '';
      }
    } catch {
      this.messageService.addMessage({
        content: 'Business tools are temporarily unavailable.',
        type: 'info',
      });
    } finally {
      this.loadingBusiness.set(false);
    }
  }

  isBusinessOwner(): boolean {
    const page = this.businessPage();
    if (!page) return false;

    const userData = this.authState.getUserData();
    const actingProfileId = this.authState.getActingProfileId();
    return (
      page.userId === userData?.userId ||
      (typeof (page as { ownerId?: string }).ownerId === 'string' &&
        (page as { ownerId?: string }).ownerId === userData?.userId) ||
      page.userId === actingProfileId
    );
  }

  async startBusinessCheckout(): Promise<void> {
    const community = this.community();
    if (!community) return;

    if (!this.isAuthenticated()) {
      this.promptSignIn('create-business-page');
      return;
    }

    this.businessCheckoutInProgress.set(true);
    try {
      const { checkoutUrl } = await this.paymentService.createBusinessPage(
        community.id,
        this.selectedBusinessTier()
      );
      window.location.href = checkoutUrl;
    } catch {
      this.messageService.addMessage({
        content: 'Failed to start business page setup. Please try again.',
        type: 'error',
      });
    } finally {
      this.businessCheckoutInProgress.set(false);
    }
  }

  async saveBusinessProfile(): Promise<void> {
    const community = this.community();
    if (!community) return;

    if (!this.isBusinessOwner()) {
      this.messageService.addMessage({
        content: 'Only the business owner can update this profile.',
        type: 'info',
      });
      return;
    }

    if (!this.businessName.trim()) {
      this.messageService.addMessage({
        content: 'Business name is required.',
        type: 'error',
      });
      return;
    }

    this.savingBusinessProfile.set(true);
    try {
      const updated = await this.paymentService.updateBusinessPage(
        community.id,
        {
          name: this.businessName.trim(),
          description: this.businessDescription.trim() || undefined,
          website: this.businessWebsite.trim() || undefined,
          phone: this.businessPhone.trim() || undefined,
          email: this.businessEmail.trim() || undefined,
          address: this.businessAddress.trim() || undefined,
        }
      );
      this.businessPage.set(updated);
      this.messageService.addMessage({
        content: 'Business page updated successfully.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to update business page.',
        type: 'error',
      });
    } finally {
      this.savingBusinessProfile.set(false);
    }
  }

  async startSponsorshipCheckout(): Promise<void> {
    const community = this.community();
    if (!community) return;

    if (!this.isAuthenticated()) {
      this.promptSignIn('sponsor-community');
      return;
    }

    this.sponsorshipCheckoutInProgress.set(true);
    try {
      const { checkoutUrl } = await this.paymentService.createSponsorship(
        community.id,
        this.selectedSponsorshipType(),
        this.sponsorshipAdContent.trim() || undefined
      );
      window.location.href = checkoutUrl;
    } catch {
      this.messageService.addMessage({
        content: 'Failed to start sponsorship checkout. Please try again.',
        type: 'error',
      });
    } finally {
      this.sponsorshipCheckoutInProgress.set(false);
    }
  }

  navigateToClassifieds(): void {
    const slug = this.community()?.slug;
    if (slug) {
      this.router.navigate(['/c', slug, 'classifieds']);
    }
  }

  navigateToCity(): void {
    const community = this.community();
    if (community) {
      this.communityService
        .getCitySlugForCommunity(community.slug)
        .then((citySlug) => {
          if (citySlug) {
            this.router.navigate(['/city', citySlug]);
          } else {
            this.router.navigate(['/cities']);
          }
        });
    }
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }

  promptSignIn(action: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, action },
    });
  }

  promptJoin(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('join');
      return;
    }
    const community = this.community();
    if (!community) return;
    this.joinCommunity(community.id);
  }

  async joinCommunity(communityId: string): Promise<void> {
    this.joiningInProgress.set(true);
    try {
      await this.communityService.joinCommunity(communityId);
      this.isMember.set(true);
      this.messageService.addMessage({
        content: 'You have joined the community!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to join the community. Please try again.',
        type: 'error',
      });
    } finally {
      this.joiningInProgress.set(false);
    }
  }

  async leaveCommunity(): Promise<void> {
    const community = this.community();
    if (!community) return;
    this.joiningInProgress.set(true);
    try {
      await this.communityService.leaveCommunity(community.id);
      this.isMember.set(false);
      this.messageService.addMessage({
        content: 'You have left the community.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to leave the community. Please try again.',
        type: 'error',
      });
    } finally {
      this.joiningInProgress.set(false);
    }
  }
}
