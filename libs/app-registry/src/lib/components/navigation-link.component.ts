import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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

  constructor(private readonly navigation: NavigationService) {}

  get url(): string {
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
