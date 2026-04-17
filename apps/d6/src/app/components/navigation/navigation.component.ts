import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AppBarComponent,
  NavSidebarComponent,
} from '@optimistic-tanuki/navigation-ui';
import { AuthStateService } from '../../services/auth-state.service';

interface NavItem {
  label: string;
  action?: () => void;
  variant?:
    | 'primary'
    | 'secondary'
    | 'outlined'
    | 'text'
    | 'warning'
    | 'danger'
    | 'success'
    | 'rounded';
  isActive?: boolean;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, AppBarComponent, NavSidebarComponent],
  template: `
    <otui-app-bar
      [appTitle]="'D6'"
      [showThemeToggle]="true"
      (menuToggle)="toggleSidebar()"
    >
    </otui-app-bar>

    <otui-nav-sidebar
      [isOpen]="sidebarOpen()"
      [navItems]="navItems"
      [heading]="'Navigation'"
      (close)="closeSidebar()"
    >
    </otui-nav-sidebar>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class NavigationComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);

  sidebarOpen = signal(false);

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      action: () => this.navigateTo('/dashboard'),
      variant: 'primary',
    },
    {
      label: 'Daily Four',
      action: () => this.navigateTo('/daily-four'),
      variant: 'secondary',
    },
    {
      label: 'Daily Six',
      action: () => this.navigateTo('/daily-six'),
      variant: 'secondary',
    },
    {
      label: 'Community Feed',
      action: () => this.navigateTo('/feed'),
      variant: 'secondary',
    },
    {
      label: 'Profile',
      action: () => this.navigateTo('/profile'),
      variant: 'secondary',
    },
    {
      label: 'About',
      action: () => this.navigateTo('/about'),
      variant: 'text',
    },
    {
      label: 'Logout',
      action: () => this.logout(),
      variant: 'text',
    },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeSidebar();
  }

  private logout(): void {
    this.authState.logout();
    this.router.navigate(['/login']);
    this.closeSidebar();
  }
}
