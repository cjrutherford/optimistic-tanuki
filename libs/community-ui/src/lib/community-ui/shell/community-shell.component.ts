import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  ActivatedRoute,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import { CommunityService } from '../services/community.service';

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
export class CommunityShellComponent extends Variantable implements OnInit {
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
      this.userValidPermissions = data['userValidPermissions'] || [];
      this.userLoggedIn = data['userLoggedIn'] || false;
      this.currentUserId = data['currentUserId'] || '';
      this.isLoggedIn.set(this.userLoggedIn);
    });

    this.route.url.subscribe((url) => {
      const path = url[0]?.path;
      if (path === 'create') {
        this.activeTab.set('create');
      } else if (path === 'manage') {
        this.activeTab.set('manage');
      } else if (path && /^\d+$/.test(path)) {
        // It's a community ID (numeric) - user is viewing community posts
        this.activeTab.set('find');
      } else {
        this.activeTab.set('find');
      }
    });
  }

  onFindCommunities() {
    this.activeTab.set('find')
    this.router.navigate(['/communities']);
  }

  onCreateCommunity() {
    this.activeTab.set('create')
    this.router.navigate(['/communities/create']);
  }

  onManageGroups() {
    this.activeTab.set('manage')
    this.router.navigate(['/communities/manage']);
  }
}
