import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export interface OAuthProviderEvent {
  provider: 'google' | 'github' | 'microsoft' | 'facebook';
}

const VALID_PROVIDERS = [
  'google',
  'github',
  'microsoft',
  'facebook',
] as const;

@Component({
  selector: 'lib-oauth-buttons',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './oauth-buttons.component.html',
  styleUrls: ['./oauth-buttons.component.scss'],
  host: {
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
  },
})
export class OAuthButtonsComponent extends Themeable {
  @Input() enabledProviders: string[] = [
    'google',
    'github',
    'microsoft',
    'facebook',
  ];
  @Input() showDivider = true;
  @Output() providerSelected = new EventEmitter<OAuthProviderEvent>();

  providers = [
    { id: 'google', label: 'Google', ariaLabel: 'Sign in with Google' },
    { id: 'github', label: 'GitHub', ariaLabel: 'Sign in with GitHub' },
    {
      id: 'microsoft',
      label: 'Microsoft',
      ariaLabel: 'Sign in with Microsoft',
    },
    { id: 'facebook', label: 'Facebook', ariaLabel: 'Sign in with Facebook' },
  ];

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
  }

  get visibleProviders() {
    return this.providers.filter((p) => this.enabledProviders.includes(p.id));
  }

  onProviderClick(providerId: string) {
    if (
      VALID_PROVIDERS.includes(providerId as (typeof VALID_PROVIDERS)[number])
    ) {
      this.providerSelected.emit({
        provider: providerId as OAuthProviderEvent['provider'],
      });
    }
  }
}
