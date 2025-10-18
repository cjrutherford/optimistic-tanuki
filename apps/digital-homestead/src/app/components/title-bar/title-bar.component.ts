import { Component, signal } from '@angular/core';

import { AppBarComponent, NavSidebarComponent, NavItem } from '@optimistic-tanuki/navigation-ui'

@Component({
  selector: 'dh-title-bar',
  imports: [AppBarComponent, NavSidebarComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  menuOpen = signal(false);
  navItems: NavItem[] = [
    {
      label: 'About',
      action: () => this.navigateTo('#about'),
    },
    {
      label: 'Benefits',
      action: () => this.navigateTo('#benefits'),
    },
    {
      label: 'Community',
      action: () => this.navigateTo('#community'),
    },
    {
      label: 'Resources',
      action: () => this.navigateTo('#resources'),
    },
    {
      label: 'Blog',
      action: () => this.navigateTo('#blog'),
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

