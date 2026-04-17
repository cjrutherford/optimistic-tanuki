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
import { OPERATOR_WORKSPACES } from '../operator-workspaces';

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
    this.themeService.setPersonality('control-center');
    this.themeService.setPrimaryColor('#2dd4bf');

    this.theme$.pipe(takeUntil(this.destroy$)).subscribe((theme) => {
      // Theme changes are handled by ThemeService via CSS variables
    });

    this.navItems = this.buildNavItems();

    // Navigate to overview by default
    if (this.router.url === '/dashboard') {
      this.router.navigate(['/dashboard/overview']);
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

  private buildNavItems(): NavItem[] {
    const workspaceNav = [
      {
        label: 'Overview',
        route: '/dashboard/overview',
      },
      ...OPERATOR_WORKSPACES.map((workspace) => ({
        label: workspace.label,
        route: `/dashboard/${workspace.path}`,
      })),
      {
        label: 'Operations',
        route: '/dashboard/operations',
      },
    ];

    return [
      ...workspaceNav.map((item) => ({
        label: item.label,
        action: () => this.router.navigate([item.route]),
        variant: 'text' as const,
        isActive: this.router.url.startsWith(item.route),
      })),
      {
        label: 'Logout',
        action: () => this.logout(),
        variant: 'danger',
      },
    ];
  }
}
