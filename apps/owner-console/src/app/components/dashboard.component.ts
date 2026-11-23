import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { AuthService } from '../services/auth.service';
import { DASHBOARD_NAV_ENTRIES, activeNavRoute } from '../dashboard-nav';

/** The sidebar overlays the page at or below this width, so it starts closed. */
export const DESKTOP_SIDEBAR_QUERY = '(min-width: 769px)';

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
  private platformId = inject(PLATFORM_ID);

  sidebarOpen = false;
  navItems: NavItem[] = [];
  theme$ = this.themeService.theme;

  constructor(authService: AuthService, router: Router) {
    this.authService = authService;
    this.router = router;
  }

  ngOnInit(): void {
    this.sidebarOpen = this.isDesktopWidth();
    this.navItems = this.buildNavItems();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.navItems = this.buildNavItems();
      });
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

  get themeToggleLabel(): string {
    return this.themeService.theme.getValue() === 'dark'
      ? 'Light Mode'
      : 'Dark Mode';
  }

  private isDesktopWidth(): boolean {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches;
  }

  private buildNavItems(): NavItem[] {
    const active = activeNavRoute(this.router.url);

    return [
      ...DASHBOARD_NAV_ENTRIES.map((entry) => ({
        label: entry.label,
        action: () => this.router.navigate([entry.route]),
        variant: 'text' as const,
        isActive: entry.route === active,
      })),
      {
        label: 'Logout',
        action: () => this.logout(),
        variant: 'danger' as const,
      },
    ];
  }
}
