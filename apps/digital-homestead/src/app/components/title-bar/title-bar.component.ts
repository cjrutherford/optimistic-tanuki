import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AppBarComponent, NavSidebarComponent, NavItem } from '@optimistic-tanuki/navigation-ui'

@Component({
  selector: 'dh-title-bar',
  imports: [AppBarComponent, NavSidebarComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  private readonly router = inject(Router);
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
      label: 'Blog Posts',
      action: () => this.navigateToRoute('/blog'),
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

  navigateToRoute(route: string) {
    this.router.navigate([route]);
    this.menuOpen.set(false);
  }
}

