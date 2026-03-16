import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  City,
  LocalCommunity,
  CityPost,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { MapComponent } from '../../components/map/map.component';
import { DonationProgressComponent } from '../../components/donation-progress/donation-progress.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { PaymentService, BusinessPage } from '../../services/payment.service';

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
    ModalComponent,
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

  city = signal<City | null>(null);
  communities = signal<LocalCommunity[]>([]);
  communityTree = signal<CommunityTreeNode[]>([]);
  posts = signal<CityPost[]>([]);
  businesses = signal<BusinessPage[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  memberCommunityIds = signal<Set<string>>(new Set());
  expandingInProgress = signal<string | null>(null);

  showCreateCommunityModal = signal(false);
  showCreateBusinessModal = signal(false);
  creatingCommunity = signal(false);
  creatingBusiness = signal(false);

  newCommunityName = '';
  newCommunityDescription = '';
  newCommunityType: 'town' | 'neighborhood' | 'county' | 'region' =
    'neighborhood';
  selectedBusinessTier = signal<'basic' | 'pro' | 'enterprise'>('basic');

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

      const tree = this.buildCommunityTree(communitiesData);
      this.communityTree.set(tree);

      const postsData = await this.communityService.getPostsForCity(slug);
      this.posts.set(postsData);

      // Load businesses for this city
      try {
        const businessesData = await this.paymentService.getCityBusinesses(
          cityData.id
        );
        this.businesses.set(businessesData);
      } catch {
        // Non-fatal - businesses are optional
      }

      // Use synchronous auth check to avoid API call when not logged in
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

    // Sub-communities are those with parentId === city.id, or those sharing
    // the same city name but not of type 'city' themselves (legacy support)
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
      this.communityTree.update((tree) => {
        const toggleNode = (
          nodes: CommunityTreeNode[]
        ): CommunityTreeNode[] => {
          return nodes.map((node) => {
            if (node.community.id === communityId) {
              return { ...node, isExpanded: !node.isExpanded };
            }
            if (node.children.length > 0) {
              return { ...node, children: toggleNode(node.children) };
            }
            return node;
          });
        };
        return toggleNode(tree);
      });
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
      const newCommunity = await this.communityService.createCommunity({
        name: this.newCommunityName.trim(),
        description: this.newCommunityDescription.trim(),
        parentId: cityData.id,
        localityType: this.newCommunityType,
      });
      this.showCreateCommunityModal.set(false);
      this.messageService.addMessage({
        content: 'Community created successfully!',
        type: 'success',
      });
      this.newCommunityName = '';
      this.newCommunityDescription = '';
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
}
