import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AppBarComponent, NavSidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();
  private authService: AuthService;
  private router: Router;

  sidebarOpen = false;
  navItems: NavItem[] = [];
  theme$ = this.themeService.theme;

  constructor(authService: AuthService, router: Router) {
    this.authService = authService;
    this.router = router;
  }

  ngOnInit(): void {
    this.theme$.pipe(takeUntil(this.destroy$)).subscribe((theme) => {
      // Theme changes are handled by ThemeService via CSS variables
    });

    this.navItems = [
      {
        label: 'Users',
        action: () => this.router.navigate(['/dashboard/users']),
        variant: 'text',
        isActive: this.router.url.includes('/users'),
      },
      {
        label: 'Roles',
        action: () => this.router.navigate(['/dashboard/roles']),
        variant: 'text',
        isActive: this.router.url.includes('/roles'),
      },
      {
        label: 'Permissions',
        action: () => this.router.navigate(['/dashboard/permissions']),
        variant: 'text',
        isActive:
          this.router.url.includes('/permissions') &&
          !this.router.url.includes('/permissions-inspector'),
      },
      {
        label: 'Permissions Inspector',
        action: () =>
          this.router.navigate(['/dashboard/permissions-inspector']),
        variant: 'text',
        isActive: this.router.url.includes('/permissions-inspector'),
      },
      {
        label: 'App Scopes',
        action: () => this.router.navigate(['/dashboard/app-scopes']),
        variant: 'text',
        isActive: this.router.url.includes('/app-scopes'),
      },
      {
        label: 'Theme',
        action: () => this.router.navigate(['/dashboard/theme']),
        variant: 'text',
        isActive: this.router.url.includes('/theme'),
      },
      {
        label: 'Store Overview',
        action: () => this.router.navigate(['/dashboard/store/overview']),
        variant: 'text',
        isActive: this.router.url.includes('/store/overview'),
      },
      {
        label: 'Products',
        action: () => this.router.navigate(['/dashboard/store/products']),
        variant: 'text',
        isActive: this.router.url.includes('/store/products'),
      },
      {
        label: 'Orders',
        action: () => this.router.navigate(['/dashboard/store/orders']),
        variant: 'text',
        isActive: this.router.url.includes('/store/orders'),
      },
      {
        label: 'App Config',
        action: () => this.router.navigate(['/dashboard/app-config']),
        variant: 'text',
        isActive: this.router.url.includes('/app-config'),
      },
      {
        label: 'Communities',
        action: () => this.router.navigate(['/dashboard/communities']),
        variant: 'text',
        isActive: this.router.url.includes('/communities'),
      },
      {
        label: 'Cities',
        action: () => this.router.navigate(['/dashboard/cities']),
        variant: 'text',
        isActive: this.router.url.includes('/cities'),
      },
      {
        label: 'Logout',
        action: () => this.logout(),
        variant: 'danger',
      },
    ];

    // Navigate to users by default
    if (this.router.url === '/dashboard') {
      this.router.navigate(['/dashboard/users']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.authService.logout();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
