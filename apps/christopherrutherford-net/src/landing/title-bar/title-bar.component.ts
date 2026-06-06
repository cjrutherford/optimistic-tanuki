import { Component, signal } from '@angular/core';

import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';

@Component({
  selector: 'app-title-bar',
  imports: [AppBarComponent, NavSidebarComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  menuOpen = signal(false);
  navItems: NavItem[] = [
    {
      label: 'Home',
      action: () => this.navigateTo('#home'),
    },
    {
      label: 'Offer',
      action: () => this.navigateTo('#offer'),
    },
    {
      label: 'Work',
      action: () => this.navigateTo('#work'),
    },
    {
      label: 'Capabilities',
      action: () => this.navigateTo('#capabilities'),
    },
    {
      label: 'Contact',
      action: () => this.navigateTo('#contact'),
    },
  ];

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  navigateTo(anchor: string) {
    window.location.href = anchor;
  }
}
