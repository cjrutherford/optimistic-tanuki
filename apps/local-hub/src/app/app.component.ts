import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { Subject, filter } from 'rxjs';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { Router } from '@angular/router';
import { DevInfoComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { MessageComponent } from '@optimistic-tanuki/message-ui';
import { AuthStateService } from './services/auth-state.service';
import { ParticleVeilComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    DevInfoComponent,
    HaiAboutTagComponent,
    MessageComponent,
    ParticleVeilComponent,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  themeName = signal('light-theme');
  themeService = inject(ThemeService);

  public authState = inject(AuthStateService);
  public currentUrl$!: Observable<string>;

  private destroy$ = new Subject<void>();

  isNavExpanded = signal(false);
  isAuthenticated = signal(false);
  navItems = signal<NavItem[]>([]);

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  title = 'Towne Square';
  readonly haiAboutConfig = {
    appId: 'towne-square',
    appName: 'Towne Square',
    appTagline: 'Neighborhood commerce and local community tools.',
    appDescription:
      'Towne Square is HAI software for local communities, neighborhood commerce, and civic connection that still feels human-scale.',
    appUrl: '/towne-square',
  };

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get reducedMotion(): boolean {
    if (!this.isBrowser) {
      return true;
    }

    if (typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  ngOnInit() {
    this.currentUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects),
      startWith(this.router.url)
    );

    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        this.updateNavItems();
      });

    this.currentUrl$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateNavItems();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateNavItems() {
    const currentUrl = this.router.url;
    if (this.isAuthenticated()) {
      this.navItems.set([
        {
          label: 'Cities',
          action: () => this.navigateTo('/cities'),
          isActive:
            currentUrl.startsWith('/cities') || currentUrl.startsWith('/city/'),
        },
        {
          label: 'Communities',
          action: () => this.navigateTo('/communities'),
          isActive:
            currentUrl.startsWith('/communities') ||
            currentUrl.startsWith('/c/'),
        },
        {
          label: 'Seller Dashboard',
          action: () => this.navigateTo('/seller-dashboard'),
          isActive: currentUrl.startsWith('/seller-dashboard'),
        },
        {
          label: 'Messages',
          action: () => this.navigateTo('/messages'),
          isActive: currentUrl.startsWith('/messages'),
        },
        {
          label: 'Account',
          action: () => this.navigateTo('/account'),
          isActive: currentUrl === '/account',
        },
        {
          label: 'Logout',
          action: () => this.logout(),
        },
      ]);
    } else {
      this.navItems.set([
        {
          label: 'Cities',
          action: () => this.navigateTo('/cities'),
          isActive:
            currentUrl.startsWith('/cities') || currentUrl.startsWith('/city/'),
        },
        {
          label: 'Communities',
          action: () => this.navigateTo('/communities'),
          isActive:
            currentUrl.startsWith('/communities') ||
            currentUrl.startsWith('/c/'),
        },
        {
          label: 'Login',
          action: () => this.navigateTo('/login'),
          isActive: currentUrl === '/login',
        },
        {
          label: 'Register',
          action: () => this.navigateTo('/register'),
          isActive: currentUrl === '/register',
        },
      ]);
    }
  }

  toggleNav() {
    this.isNavExpanded.set(!this.isNavExpanded());
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
    this.isNavExpanded.set(false);
  }

  logout() {
    this.authState.logout();
    this.router.navigate(['/']);
  }
}
