import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { CommunityService } from '../services/community.service';
import {
  CommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  CommunityWithActivity,
} from '../models';

@Component({
  selector: 'lib-find-communities',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
  ],
  host: {
    '[class.theme]': 'theme',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-variant]': 'variant',
  },
  templateUrl: './find-communities.component.html',
  styleUrls: ['./find-communities.component.scss'],
})
export class FindCommunitiesComponent extends Variantable implements OnInit {
  private readonly communityService = inject(CommunityService);

  searchControl = new FormControl('');

  communities = signal<CommunityDto[]>([]);
  topActiveCommunities = signal<CommunityWithActivity[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  userMemberships = signal<Map<string, CommunityMemberDto>>(new Map());
  userOwnerships = signal<Set<string>>(new Set());
  currentUserId = '';

  displayMode = signal<'all' | 'top'>('all');

  variant!: string;
  backgroundFilter!: string;
  borderWidth!: string;
  borderRadius!: string;
  borderStyle!: string;
  backgroundGradient!: string;
  svgPattern!: string;
  glowFilter!: string;
  gradientType!: string;
  gradientStops!: string;
  gradientColors!: string;
  animation!: string;
  hoverBoxShadow!: string;
  hoverGradient!: string;
  hoverGlowFilter!: string;
  insetShadow!: string;
  bodyGradient!: string;
  backgroundPattern!: string;

  applyVariant(colors: ThemeColors, options?: VariantOptions): void {
    this.variant = options?.variant || 'default';
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.borderGradient =
      this.theme === 'dark'
        ? colors.complementaryGradients?.['dark']
        : colors.complementaryGradients?.['light'];
  }

  override ngOnInit() {
    this.loadUserMemberships();
    this.loadTopActive();
    this.loadAllCommunities();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.searchCommunities(query || '');
      });
  }

  async loadUserMemberships() {
    try {
      const profile = await this.communityService.getCurrentUserProfile();
      if (profile) {
        this.currentUserId = profile.id;
        const userCommunities =
          await this.communityService.getUserCommunities();
        const memberships = new Map<string, CommunityMemberDto>();
        const ownerships = new Set<string>();

        for (const community of userCommunities) {
          memberships.set(community.id, {
            id: '',
            communityId: community.id,
            userId: profile.userId,
            profileId: profile.id,
            role:
              community.ownerId === profile.userId
                ? ('owner' as any)
                : ('member' as any),
            status: 'approved' as any,
            joinedAt: new Date(),
          });

          if (
            community.ownerIds?.includes(profile.userId) ||
            community.ownerId === profile.userId
          ) {
            ownerships.add(community.id);
          }
        }
        this.userMemberships.set(memberships);
        this.userOwnerships.set(ownerships);
      }
    } catch (err) {
      console.error('Error loading user memberships:', err);
    }
  }

  async loadTopActive() {
    this.loading.set(true);
    try {
      const communities = await this.communityService.getTopActive(10);
      this.topActiveCommunities.set(
        communities.map((c) => ({
          ...c,
          activityScore: 0,
          postsLast30Days: 0,
          commentsLast30Days: 0,
          votesLast30Days: 0,
          newMembersLast30Days: 0,
        }))
      );
    } catch (err) {
      console.error('Error loading top active communities:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadAllCommunities() {
    this.loading.set(true);
    try {
      const communities = await this.communityService.findAll({});
      this.communities.set(communities);
    } catch (err) {
      console.error('Error loading communities:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async searchCommunities(query: string) {
    if (!query.trim()) {
      this.loadAllCommunities();
      return;
    }

    this.loading.set(true);
    try {
      const communities = await this.communityService.findAll({ name: query });
      this.communities.set(communities);
    } catch (err) {
      console.error('Error searching communities:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async joinCommunity(community: CommunityDto) {
    try {
      const dto: JoinCommunityDto = { communityId: community.id };
      const membership = await this.communityService.join(community.id, dto);

      const updatedMemberships = new Map(this.userMemberships());
      updatedMemberships.set(community.id, membership);
      this.userMemberships.set(updatedMemberships);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to join community');
      console.error('Error joining community:', err);
    }
  }

  getMembershipStatus(communityId: string): 'member' | 'pending' | 'none' {
    const membership = this.userMemberships().get(communityId);
    if (!membership) return 'none';
    return membership.status === 'approved' ? 'member' : 'pending';
  }

  canManage(communityId: string): boolean {
    return this.userOwnerships().has(communityId);
  }

  setDisplayMode(mode: 'all' | 'top') {
    this.displayMode.set(mode);
  }
}
