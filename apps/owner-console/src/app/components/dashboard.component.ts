import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppBarComponent } from '@optimistic-tanuki/navigation-ui';
import { AuthService } from '../services/auth.service';
import { OwnerAccessService } from '../services/owner-access.service';
import {
  OWNER_NAV,
  OwnerNavEntry,
  activeNavPath,
  filterNavByPermission,
  navigableEntries,
} from '../owner-nav';
import { CommandPaletteComponent } from '../shell/command-palette.component';
import { OwnerBreadcrumbsComponent } from '../shell/owner-breadcrumbs.component';
import { OwnerSidebarComponent } from '../shell/owner-sidebar.component';

/** At or above this width the sidebar is docked; below it is a modal drawer. */
export const DESKTOP_SIDEBAR_QUERY = '(min-width: 769px)';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppBarComponent,
    OwnerSidebarComponent,
    OwnerBreadcrumbsComponent,
    CommandPaletteComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);
  private access = inject(OwnerAccessService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private mediaQuery?: MediaQueryList;
  private readonly onMediaChange = (event: { matches: boolean }): void =>
    this.setDesktop(event.matches);

  /** Wide screens dock the sidebar; narrow ones overlay it as a drawer. */
  readonly desktop = signal(false);
  readonly sidebarOpen = signal(false);
  readonly paletteOpen = signal(false);
  readonly url = signal('');
  /** Bumped once permissions load so the nav re-filters. */
  private readonly accessLoaded = signal(false);

  readonly groups = computed(() => {
    this.accessLoaded();
    return filterNavByPermission(this.access.can).map((group) => ({
      ...group,
      leaves: group.leaves.filter((leaf) => !leaf.needsTown),
    }));
  });
  readonly paletteEntries = computed(() => {
    this.accessLoaded();
    return navigableEntries(this.groups());
  });
  readonly activePath = computed(() => activeNavPath(this.url(), OWNER_NAV));

  theme$ = this.themeService.theme;

  ngOnInit(): void {
    this.url.set(this.router.url);
    this.setupViewport();
    this.access
      .load()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.accessLoaded.set(true));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.url.set(this.router.url));
  }

  ngOnDestroy(): void {
    this.mediaQuery?.removeEventListener?.('change', this.onMediaChange);
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((open) => !open);
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /** A sidebar link was followed: the drawer closes, the docked bar stays. */
  onNavigated(): void {
    if (!this.desktop()) {
      this.closeSidebar();
    }
  }

  openPalette(): void {
    this.paletteOpen.set(true);
  }

  closePalette(): void {
    this.paletteOpen.set(false);
  }

  goTo(entry: OwnerNavEntry): void {
    this.router.navigateByUrl(entry.leaf.path);
    this.onNavigated();
  }

  logout(): void {
    this.access.reset();
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

  private setupViewport(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    this.mediaQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    this.setDesktop(this.mediaQuery.matches);
    this.mediaQuery.addEventListener?.('change', this.onMediaChange);
  }

  /** Crossing the breakpoint resets the sidebar to that mode's default. */
  private setDesktop(desktop: boolean): void {
    this.desktop.set(desktop);
    this.sidebarOpen.set(desktop);
  }
}
