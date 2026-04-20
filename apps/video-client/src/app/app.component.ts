import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Observable, Subscription, filter } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './services/profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { TopographicDriftComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'video-client-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    TopographicDriftComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private authState = inject(AuthStateService);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  title = 'video-client';
  background = '';
  foreground = '';
  accent = '';
  backgroundGradient = '';

  themeName = signal('light-theme');
  isNavExpanded = signal(false);
  isAuthenticated = signal(false);
  selectedProfile = signal<ProfileDto | null>(null);
  navItems = signal<NavItem[]>([]);

  currentUrl$!: Observable<string>;
  private themeSub?: Subscription;
  private authSub?: Subscription;
  private urlSub?: Subscription;

  ngOnInit() {
    this.currentUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects),
      startWith(this.router.url),
    );

    this.authSub = this.authState.isAuthenticated$.subscribe({
      next: (isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        if (isAuthenticated) {
          this.selectedProfile.set(this.profileService.getCurrentUserProfile());
        }
        this.updateNavItems();
      },
    });

    // Subscribe to currentUrl$ to update active state
    this.urlSub = this.currentUrl$.subscribe(() => {
      this.updateNavItems();
    });

    // Initialize theme - only in browser to avoid SSR issues
    if (isPlatformBrowser(this.platformId)) {
      const currentPalette = this.themeService.getCurrentPalette();
      if (!currentPalette) {
        // Set default palette for video-client
        this.themeService.setPalette('Sunset Vibes');
      }
      // Apply stored or default theme mode
      this.themeService.setTheme(this.themeService.getTheme());
    }

    this.themeSub = this.themeService.themeColors$.subscribe(
      (theme: ThemeColors | undefined) => {
        if (!theme || !isPlatformBrowser(this.platformId)) return;
        this.themeName.set(this.themeService.getTheme());
        this.background = theme.background;
        this.foreground = theme.foreground;
        this.accent = theme.accent;
        this.backgroundGradient = theme.accentGradients['light'];
      },
    );
  }

  ngOnDestroy() {
    if (this.themeSub) this.themeSub.unsubscribe();
    if (this.authSub) this.authSub.unsubscribe();
    if (this.urlSub) this.urlSub.unsubscribe();
  }

  updateNavItems() {
    const currentUrl = this.router.url;
    if (this.isAuthenticated()) {
      this.navItems.set([
        {
          label: 'Home',
          action: () => this.navigateTo('/'),
          isActive: currentUrl === '/',
        },
        {
          label: 'My Channel',
          action: () => this.navigateTo('/my-channel'),
          isActive: currentUrl === '/my-channel',
        },
        {
          label: 'Upload',
          action: () => this.navigateTo('/upload'),
          isActive: currentUrl === '/upload',
        },
        {
          label: 'History',
          action: () => this.navigateTo('/history'),
          isActive: currentUrl === '/history',
        },
        {
          label: 'Profile',
          action: () => this.navigateTo('/profile'),
          isActive: currentUrl === '/profile',
        },
        {
          label: 'Logout',
          action: () => this.loginOutButton(),
        },
      ]);
    } else {
      this.navItems.set([
        {
          label: 'Home',
          action: () => this.navigateTo('/'),
          isActive: currentUrl === '/',
        },
        {
          label: 'Login',
          action: () => this.loginOutButton(),
        },
        {
          label: 'Register',
          action: () => this.navigateTo('/register'),
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

  loginOutButton() {
    if (this.isAuthenticated()) {
      this.authState.logout();
      this.isAuthenticated.set(false);
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
