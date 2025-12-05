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
      label: 'About',
      action: () => this.navigateTo('#about'),
    },
    {
      label: 'Projects',
      action: () => this.navigateTo('#projects'),
    },
    {
      label: 'Services',
      action: () => this.navigateTo('#services'),
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
