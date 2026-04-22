import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { GeneratedLink, NavigationPosition } from '../navigation.types';
import { NavigationService } from '../navigation.service';

@Component({
  selector: 'ot-registry-navigation-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="registry-nav-menu" [class]="'registry-nav-menu--' + position">
      @for (link of links; track link.url) {
      <a [href]="link.url" class="registry-nav-menu__link">
        @if (link.meta.iconName) {
        <span aria-hidden="true">{{ link.meta.iconName }}</span>
        }
        <span>{{ link.meta.label }}</span>
      </a>
      }
    </nav>
  `,
})
export class NavigationMenuComponent implements OnChanges {
  @Input({ required: true }) appId!: string;
  @Input() position: NavigationPosition = 'primary';
  @Input() isAuthenticated = false;

  links: GeneratedLink[] = [];

  constructor(private readonly navigation: NavigationService) {}

  ngOnChanges(): void {
    this.navigation
      .getFilteredLinks({
        currentAppId: this.appId,
        currentPath: '/',
        isAuthenticated: this.isAuthenticated,
      })
      .subscribe((links) => {
        this.links = links.filter((link) =>
          this.position === 'primary'
            ? true
            : link.meta.label.toLowerCase().includes(this.position)
        );
      });
  }
}
