import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  ActivatedRoute,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';

@Component({
  selector: 'lib-community-shell',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CardComponent,
    ButtonComponent,
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
  templateUrl: './community-shell.component.html',
  styleUrls: ['./community-shell.component.scss'],
})
export class CommunityShellComponent
  extends Variantable
  implements OnInit, OnDestroy
{
  private readonly communityService = inject(CommunityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  userValidPermissions: string[] = [];
  userLoggedIn = false;
  currentUserId = '';

  isLoggedIn = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  activeTab = signal<'find' | 'create' | 'manage'>('find');
  sidebarCollapsed = signal(false);
  userCommunities = signal<CommunityDto[]>([]);
  currentCommunityId = signal<string | null>(null);

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
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.userValidPermissions = data['userValidPermissions'] || [];
      this.userLoggedIn = data['userLoggedIn'] || false;
      this.currentUserId = data['currentUserId'] || '';
      this.isLoggedIn.set(this.userLoggedIn);
    });

    this.route.url.pipe(takeUntil(this.destroy$)).subscribe((url) => {
      const path = url[0]?.path;
      if (path === 'create') {
        this.activeTab.set('create');
        this.currentCommunityId.set(null);
      } else if (path === 'manage') {
        this.activeTab.set('manage');
        this.currentCommunityId.set(null);
      } else if (path && /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/i.test(path)) {
        // Accept both UUIDs and slugs (lowercase alphanumeric with hyphens)
        this.activeTab.set('find');
        this.currentCommunityId.set(path);
      } else {
        this.activeTab.set('find');
        this.currentCommunityId.set(null);
      }
    });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const communitySlug = params['communitySlug'];
      if (communitySlug) {
        this.currentCommunityId.set(communitySlug);
      }
    });

    this.loadUserCommunities();
  }

  override ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    super.ngOnDestroy();
  }

  onFindCommunities() {
    this.activeTab.set('find');
    this.router.navigate(['/communities']);
  }

  onCreateCommunity() {
    this.activeTab.set('create');
    this.router.navigate(['/communities/create']);
  }

  onManageGroups() {
    this.activeTab.set('manage');
    this.router.navigate(['/communities/manage']);
  }

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }

  loadUserCommunities() {
    this.communityService
      .getUserCommunities()
      .then((communities) => {
        this.userCommunities.set(communities);
      })
      .catch((err) => {
        console.error('Failed to load user communities:', err);
      });
  }

  navigateToCommunity(community: { id: string; slug?: string | null }) {
    const slug = community.slug || community.id;
    const currentSlug = this.currentCommunityId();
    if (currentSlug === slug) {
      window.location.reload();
    } else {
      this.router.navigate(['/communities', slug, 'posts']);
    }
  }
}
