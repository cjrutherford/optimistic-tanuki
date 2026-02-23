import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';

@Component({
  selector: 'lib-manage-groups',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [CommonModule, RouterLink, CardComponent, ButtonComponent],
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
  templateUrl: './manage-groups.component.html',
  styleUrls: ['./manage-groups.component.scss'],
})
export class ManageGroupsComponent extends Variantable implements OnInit {
  private readonly communityService = inject(CommunityService);
  private readonly route = inject(ActivatedRoute);

  ownedCommunities = signal<CommunityDto[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  currentUserId = '';

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
    this.route.data.subscribe((data) => {
      this.currentUserId = data['currentUserId'] || '';
      if (this.currentUserId) {
        this.loadOwnedCommunities();
      }
    });
  }

  async loadOwnedCommunities() {
    this.loading.set(true);
    try {
      const communities = await this.communityService.getUserCommunities();
      this.ownedCommunities.set(communities);
    } catch (err) {
      console.error('Error loading user communities:', err);
      this.error.set('Failed to load your communities');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteCommunity(community: CommunityDto) {
    if (
      !confirm(
        `Are you sure you want to delete "${community.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await this.communityService.delete(community.id);
      await this.loadOwnedCommunities();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete community');
    }
  }

  async leaveCommunity(community: CommunityDto) {
    if (!confirm(`Are you sure you want to leave "${community.name}"?`)) {
      return;
    }

    try {
      await this.communityService.leave(community.id);
      await this.loadOwnedCommunities();
    } catch (err: any) {
      this.error.set(err.message || 'Failed to leave community');
    }
  }

  isOwner(community: CommunityDto): boolean {
    return community.ownerId === this.currentUserId;
  }
}
