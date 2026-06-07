import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  OnInit,
  inject,
} from '@angular/core';
import {
  ModalComponent,
  Tab,
  TabsComponent,
  IconComponent,
} from '@optimistic-tanuki/common-ui';
import { ThemeColors, Themeable } from '@optimistic-tanuki/theme-lib';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';
import { getRandomHaiExpansion } from '../hai-types/hai-expansions';

@Component({
  selector: 'hai-about-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, TabsComponent, IconComponent],
  templateUrl: './hai-about-modal.component.html',
  styleUrl: './hai-about-modal.component.scss',
  host: {
    '[class.theme]': 'theme',
  },
})
export class HaiAboutModalComponent
  extends Themeable
  implements OnInit, OnDestroy
{
  @Input({ required: true }) config!: HaiAboutConfig;
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  private readonly appDirectory = inject(HaiAppDirectoryService);

  readonly tabs: Tab[] = [
    { id: 'app', label: 'About This App' },
    { id: 'hai', label: 'About HAI' },
    { id: 'directory', label: 'Other HAI Apps' },
  ];

  activeTab = 'app';
  currentExpansion = '';
  appLinks$ = this.appDirectory.getResolvedApps();

  override ngOnInit() {
    super.ngOnInit();
    this.currentExpansion = getRandomHaiExpansion();
    this.appLinks$ = this.appDirectory.getResolvedApps(this.config?.appId);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  override applyTheme(colors: ThemeColors): void {
    const foregroundSoft = this.mix(colors.foreground, colors.background, 0.62);
    const foregroundMuted = this.mix(
      colors.foreground,
      colors.background,
      0.48
    );
    const bodySurface = this.mix(colors.background, colors.accent, 0.08);
    const heroPanel = this.mix(colors.background, colors.complementary, 0.18);
    const iconSurface = this.mix(colors.background, colors.accent, 0.14);
    const subtleBorder = this.mix(
      colors.complementary,
      colors.background,
      0.42
    );
    const statusSurface = this.mix(colors.background, colors.accent, 0.2);
    const liveSurface = this.mix(colors.background, colors.success, 0.22);
    const secondarySurface = this.mix(
      colors.background,
      colors.foreground,
      0.06
    );
    const secondaryHover = this.mix(colors.background, colors.foreground, 0.1);
    const hairline = this.mix(colors.foreground, colors.background, 0.18);
    const markHighlight = this.alpha(colors.background, 0.3);

    this.setLocalCSSVariables({
      'hai-ink': colors.foreground,
      'hai-heading': colors.foreground,
      'hai-body': foregroundSoft,
      'hai-muted': foregroundMuted,
      'hai-accent': colors.accent,
      'hai-complement': colors.complementary,
      'hai-surface': bodySurface,
      'hai-hero-panel': heroPanel,
      'hai-mark-gradient': this.themeService.getButtonGradient('primary'),
      'hai-mark-foreground': colors.background,
      'hai-mark-highlight': markHighlight,
      'hai-card-gradient': this.themeService.getCardGradient('glass'),
      'hai-card-border': subtleBorder,
      'hai-card-shadow': 'var(--personality-card-shadow, var(--shadow-lg))',
      'hai-card-icon-surface': iconSurface,
      'hai-status-surface': statusSurface,
      'hai-status-live-surface': liveSurface,
      'hai-secondary-surface': secondarySurface,
      'hai-secondary-hover': secondaryHover,
      'hai-link-primary-background': colors.accent,
      'hai-link-primary-foreground': colors.background,
      'hai-link-secondary-foreground': colors.foreground,
      'hai-focus-ring': colors.accent,
      'hai-hairline': hairline,
      'hai-hero-shadow': `0 16px 40px ${this.alpha(colors.foreground, 0.14)}`,
      'hai-card-hover-shadow': `0 22px 44px ${this.alpha(
        colors.foreground,
        0.18
      )}`,
    });
  }

  setActiveTab(tabId: string) {
    this.activeTab = tabId;
  }

  handleClose() {
    this.close.emit();
  }

  private mix(base: string, tint: string, tintWeight: number): string {
    const clampedWeight = Math.min(Math.max(tintWeight, 0), 1);
    const baseWeight = 1 - clampedWeight;
    return `color-mix(in srgb, ${base} ${Math.round(
      baseWeight * 100
    )}%, ${tint} ${Math.round(clampedWeight * 100)}%)`;
  }

  private alpha(color: string, alpha: number): string {
    const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
    return `color-mix(in srgb, ${color} ${Math.round(
      clampedAlpha * 100
    )}%, transparent)`;
  }
}
