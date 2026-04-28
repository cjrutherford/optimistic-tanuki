import { CommonModule } from '@angular/common';
import { Component, Inject, Input, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationService } from '../navigation.service';

@Component({
  selector: 'ot-registry-navigation-link',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a
      class="registry-nav-link"
      [href]="url"
      [target]="openInNewTab ? '_blank' : '_self'"
      [rel]="openInNewTab ? 'noopener noreferrer' : null"
      (click)="handleClick($event)"
    >
      @if (iconName) {
      <span class="registry-nav-link__icon" aria-hidden="true">{{
        iconName
      }}</span>
      }
      <span>{{ label }}</span>
    </a>
  `,
})
export class NavigationLinkComponent {
  @Input({ required: true }) targetAppId!: string;
  @Input() path?: string;
  @Input() label = '';
  @Input() iconName?: string;
  @Input() openInNewTab = false;
  @Input() includeReturn = true;

  constructor(
    private readonly navigation: NavigationService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  get url(): string {
    if (this.includeReturn && isPlatformBrowser(this.platformId)) {
      return this.navigation.generateUrl(this.targetAppId, this.path, {
        returnTo: window.location.pathname,
      });
    }
    return this.navigation.generateUrl(this.targetAppId, this.path);
  }

  handleClick(event: Event): void {
    if (this.openInNewTab) {
      return;
    }

    event.preventDefault();
    this.navigation.navigate(this.targetAppId, this.path, {
      includeReturn: this.includeReturn,
    });
  }
}
