import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  City,
  LocalCommunity,
  CityPost,
  CommunityManager,
  CommunityElection,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { MapComponent } from '../../components/map/map.component';
import { DonationProgressComponent } from '../../components/donation-progress/donation-progress.component';
import { CardComponent, ModalComponent, BadgeComponent } from '@optimistic-tanuki/common-ui';
import { PaymentService, BusinessPage } from '../../services/payment.service';
import { API_BASE_URL, CreateAssetDto } from '@optimistic-tanuki/ui-models';
import {
  ClassifiedListComponent,
  ClassifiedService,
  ClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';

interface CommunityTreeNode {
  community: LocalCommunity;
  children: CommunityTreeNode[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-city',
  standalone: true,
  imports: [
    CommonModule,
    MapComponent,
    DonationProgressComponent,
    FormsModule,
    CardComponent,
    ModalComponent,
    BadgeComponent,
    ClassifiedListComponent,
  ],
  templateUrl: './city.component.html',
  styleUrls: ['./city.component.scss'],
})
export class CityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private paymentService = inject(PaymentService);
  private meta = inject(Meta);
  private title = inject(Title);
  private destroy$ = new Subject<void>();
  private classifiedService = inject(ClassifiedService);
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);

  city = signal<City | null>(null);
  communities = signal<LocalCommunity[]>([]);
  /** Only the user-created sub-communities (interest groups, etc.) */
  interestCommunities = signal<LocalCommunity[]>([]);
  posts = signal<CityPost[]>([]);
  businesses = signal<BusinessPage[]>([]);
  classifieds = signal<ClassifiedAdDto[]>([]);
  classifiedsLoading = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  memberCommunityIds = signal<Set<string>>(new Set());
  expandingInProgress = signal<string | null>(null);

  /** Currently elected manager for the root locality. */
  communityManager = signal<CommunityManager | null>(null);
  /** Active election for the root locality, if any. */
  activeElection = signal<CommunityElection | null>(null);
  votingInProgress = signal(false);

  showCreateCommunityModal = signal(false);
  showCreateBusinessModal = signal(false);
  showElectionModal = signal(false);
  creatingCommunity = signal(false);
  creatingBusiness = signal(false);

  newCommunityName = '';
  newCommunityDescription = '';
  newCommunityIsPrivate = false;
  newCommunityJoinPolicy: 'public' | 'approval_required' | 'invite_only' = 'public';
  newCommunityTags = '';
  /** Locality-type options users may choose when creating an interest community. */
  newCommunityType: 'neighborhood' | 'county' | 'region' = 'neighborhood';
  selectedBusinessTier = signal<'basic' | 'pro' | 'enterprise'>('basic');

  bannerPreview = signal<string | null>(null);
  logoPreview = signal<string | null>(null);
  bannerAssetId = signal<string | null>(null);
  logoAssetId = signal<string | null>(null);
  uploading = signal(false);

  async ngOnInit(): Promise<void> {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => {
        this.isAuthenticated.set(auth);
      });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    await this.loadCity(slug);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadCity(slug: string): Promise<void> {
    try {
      const cityData = await this.communityService.getCityBySlug(slug);

      if (!cityData) {
        this.error.set('City not found');
        this.loading.set(false);
        return;
      }

      this.city.set(cityData);
      this.updateMetaTags(cityData);

      const communitiesData = await this.communityService.getCommunitiesForCity(
        slug
      );
      this.communities.set(communitiesData);

      // Separate the root locality from user-created interest communities
      const rootLocality = communitiesData.find(
        (c) => c.localityType === 'city' && !c.parentId
      );
      const interest = communitiesData.filter((c) => {
        if (rootLocality && c.id === rootLocality.id) return false;
        return true;
      });
      this.interestCommunities.set(interest);

      const postsData = await this.communityService.getPostsForCity(slug);
      this.posts.set(postsData);

      // Load manager & election info for the root locality (non-fatal)
      if (rootLocality) {
        try {
          const [manager, election] = await Promise.all([
            this.communityService.getCommunityManager(rootLocality.id),
            this.communityService.getActiveElection(rootLocality.id),
          ]);
          this.communityManager.set(manager);
          this.activeElection.set(election);
        } catch {
          // Non-fatal - manager/election info is optional
        }
      }

      // Load businesses for this city (non-fatal)
      try {
        const allCommunityIds = communitiesData.map((c) => c.id);
        const businessesData = await this.paymentService.getCityBusinesses(
          cityData.id,
          allCommunityIds
        );
        this.businesses.set(businessesData);
      } catch {
        // Non-fatal - businesses are optional
      }

      // Load classifieds for the root community (non-fatal)
      if (rootLocality) {
        this.classifiedsLoading.set(true);
        try {
          const classifiedsData = await this.classifiedService.findByCommunity(
            rootLocality.id,
            { pageSize: 12 }
          );
          this.classifieds.set(classifiedsData.data ?? []);
        } catch {
          // Non-fatal - classifieds are optional
        } finally {
          this.classifiedsLoading.set(false);
        }
      }

      if (this.authState.isAuthenticated) {
        await this.loadMembershipStatus(communitiesData);
      }
    } catch {
      this.error.set('Failed to load city data');
    } finally {
      this.loading.set(false);
    }
  }

  private updateMetaTags(city: City): void {
    const fullTitle = `${city.name} - Local Hub`;
    this.title.setTitle(fullTitle);

    this.meta.updateTag({ name: 'description', content: city.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({
      property: 'og:description',
      content: city.description,
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    if (city.imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: city.imageUrl });
    }
  }

  private buildCommunityTree(
    communities: LocalCommunity[]
  ): CommunityTreeNode[] {
    // City community is the one with localityType === 'city' (no parentId)
    const cityCommunity = communities.find(
      (c) => c.localityType === 'city' && !c.parentId
    );
    if (!cityCommunity) return [];

    const subCommunities = communities.filter((c) => {
      if (c.id === cityCommunity.id) return false;
      return c.parentId === cityCommunity.id || !c.parentId;
    });

    const rootNode: CommunityTreeNode = {
      community: cityCommunity,
      children: subCommunities.map((comm) => ({
        community: comm,
        children: [],
        isExpanded: false,
      })),
      isExpanded: true,
    };

    return [rootNode];
  }

  private async loadMembershipStatus(
    communities: LocalCommunity[]
  ): Promise<void> {
    const memberIds = new Set<string>();
    for (const community of communities) {
      try {
        const isMember = await this.communityService.isMember(community.id);
        if (isMember) {
          memberIds.add(community.id);
        }
      } catch {
        // Non-fatal
      }
    }
    this.memberCommunityIds.set(memberIds);
  }

  toggleExpand(communityId: string): void {
    this.expandingInProgress.set(communityId);
    setTimeout(() => {
      this.expandingInProgress.set(null);
    }, 0);
  }

  isMember(communityId: string): boolean {
    return this.memberCommunityIds().has(communityId);
  }

  promptSignIn(action: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, action },
    });
  }

  async joinCommunity(communityId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      this.promptSignIn('join');
      return;
    }
    this.expandingInProgress.set(communityId);
    try {
      await this.communityService.joinCommunity(communityId);
      this.memberCommunityIds.update((ids) => {
        const newIds = new Set(ids);
        newIds.add(communityId);
        return newIds;
      });
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
      this.expandingInProgress.set(null);
    }
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  navigateToCity(slug: string): void {
    this.router.navigate(['/city', slug]);
  }

  navigateToPost(communitySlug: string): void {
    this.router.navigate(['/c', communitySlug]);
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }

  openCreateCommunityModal(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('create-community');
      return;
    }
    this.showCreateCommunityModal.set(true);
  }

  async createCommunity(): Promise<void> {
    const cityData = this.city();
    if (!cityData) return;

    if (!this.newCommunityName.trim()) {
      this.messageService.addMessage({
        content: 'Community name is required.',
        type: 'error',
      });
      return;
    }

    this.creatingCommunity.set(true);
    try {
      // Wait for any pending image uploads
      if (this.uploading()) {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (!this.uploading()) {
              clearInterval(check);
              resolve();
            }
          }, 200);
        });
      }

      const tags = this.newCommunityTags
        ? this.newCommunityTags.split(',').map((t) => t.trim()).filter((t) => t)
        : [];

      const newCommunity = await this.communityService.createCommunity({
        name: this.newCommunityName.trim(),
        description: this.newCommunityDescription.trim(),
        parentId: cityData.id,
        localityType: this.newCommunityType,
        isPrivate: this.newCommunityIsPrivate,
        joinPolicy: this.newCommunityJoinPolicy,
        tags,
        bannerAssetId: this.bannerAssetId() || undefined,
        logoAssetId: this.logoAssetId() || undefined,
      });
      this.showCreateCommunityModal.set(false);
      this.messageService.addMessage({
        content: 'Community created successfully!',
        type: 'success',
      });
      this.resetCommunityForm();
      this.router.navigate(['/c', newCommunity.slug]);
    } catch {
      this.messageService.addMessage({
        content: 'Failed to create community. Please try again.',
        type: 'error',
      });
    } finally {
      this.creatingCommunity.set(false);
    }
  }

  private resetCommunityForm(): void {
    this.newCommunityName = '';
    this.newCommunityDescription = '';
    this.newCommunityIsPrivate = false;
    this.newCommunityJoinPolicy = 'public';
    this.newCommunityTags = '';
    this.newCommunityType = 'neighborhood';
    this.bannerPreview.set(null);
    this.logoPreview.set(null);
    this.bannerAssetId.set(null);
    this.logoAssetId.set(null);
  }

  async onBannerSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    this.bannerPreview.set(await this.fileToDataUrl(file));
    this.uploading.set(true);
    try {
      this.bannerAssetId.set(await this.uploadImage(file));
    } finally {
      this.uploading.set(false);
    }
  }

  async onLogoSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    this.logoPreview.set(await this.fileToDataUrl(file));
    this.uploading.set(true);
    try {
      this.logoAssetId.set(await this.uploadImage(file));
    } finally {
      this.uploading.set(false);
    }
  }

  removeBanner(): void {
    this.bannerPreview.set(null);
    this.bannerAssetId.set(null);
  }

  removeLogo(): void {
    this.logoPreview.set(null);
    this.logoAssetId.set(null);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async uploadImage(file: File): Promise<string> {
    const dataUrl = await this.fileToDataUrl(file);
    const ext = file.name.split('.').pop() || 'png';
    const profile = await firstValueFrom(
      this.http.get<{ id: string }>(`${this.apiBaseUrl}/profile/me`)
    );
    const assetDto: CreateAssetDto = {
      name: file.name,
      profileId: profile.id,
      type: 'image',
      content: dataUrl,
      fileExtension: ext,
    };
    const asset = await firstValueFrom(
      this.http.post<{ id: string }>(`${this.apiBaseUrl}/asset`, assetDto)
    );
    return asset.id;
  }

  openCreateBusinessModal(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('create-business');
      return;
    }
    this.showCreateBusinessModal.set(true);
  }

  async createBusinessPage(): Promise<void> {
    const cityData = this.city();
    if (!cityData) return;

    this.creatingBusiness.set(true);
    try {
      const { checkoutUrl } = await this.paymentService.createBusinessPage(
        cityData.id,
        this.selectedBusinessTier()
      );
      window.location.href = checkoutUrl;
    } catch {
      this.messageService.addMessage({
        content: 'Failed to start business page setup. Please try again.',
        type: 'error',
      });
    } finally {
      this.creatingBusiness.set(false);
    }
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
    const communities = this.communities();
    const rootLocality = communities.find(
      (c) => c.localityType === 'city' && !c.parentId
    );
    if (!rootLocality) return;

    try {
      await this.communityService.nominateForManager(rootLocality.id);
      const election = await this.communityService.getActiveElection(
        rootLocality.id
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
    const communities = this.communities();
    const rootLocality = communities.find(
      (c) => c.localityType === 'city' && !c.parentId
    );
    if (!rootLocality) return;

    this.votingInProgress.set(true);
    try {
      const updatedElection = await this.communityService.voteForManager(
        rootLocality.id,
        candidateUserId
      );
      this.activeElection.set(updatedElection);
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
}
