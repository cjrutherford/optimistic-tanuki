import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 120;
const RADIUS_DEGREES = 3.6;

interface CommunityTreeNode {
  community: LocalCommunity;
  children: CommunityTreeNode[];
  isExpanded: boolean;
}

interface MarkerPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-city',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './city.component.html',
  styleUrls: ['./city.component.scss'],
})
export class CityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  city = signal<City | null>(null);
  communities = signal<LocalCommunity[]>([]);
  communityTree = signal<CommunityTreeNode[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  memberCommunityIds = signal<Set<string>>(new Set());
  expandingInProgress = signal<string | null>(null);

  Math = Math;

  getCityMarker(): MarkerPosition {
    const cityData = this.city();
    if (!cityData) return { x: 100, y: 60 };

    const lat = cityData.coordinates.lat;
    const lng = cityData.coordinates.lng;

    const latRange = RADIUS_DEGREES * 2;
    const lngRange = RADIUS_DEGREES * 2.5;
    const centerLat = 31.9;
    const centerLng = -81.1;

    const x = ((lng - centerLng + lngRange / 2) / lngRange) * VIEWBOX_WIDTH;
    const y = ((centerLat + latRange / 2 - lat) / latRange) * VIEWBOX_HEIGHT;

    return { x, y };
  }

  getCityMarkerRadius(): number {
    return (RADIUS_DEGREES / (RADIUS_DEGREES * 2.5)) * VIEWBOX_WIDTH;
  }

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

      const communitiesData =
        await this.communityService.getMockCommunitiesForCity(slug);
      this.communities.set(communitiesData);

      const tree = this.buildCommunityTree(communitiesData);
      this.communityTree.set(tree);

      if (this.isAuthenticated()) {
        await this.loadMembershipStatus(communitiesData);
      }
    } catch {
      this.error.set('Failed to load city data');
    } finally {
      this.loading.set(false);
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
}
