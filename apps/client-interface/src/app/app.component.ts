/* eslint-disable @typescript-eslint/no-unused-vars */
import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Observable, Subscription, filter } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { AuthStateService } from './state/auth-state.service';
import { AppBarComponent, NavSidebarComponent, NavItem } from '@optimistic-tanuki/navigation-ui';
import { ProfileService } from './profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

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
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  background!: string;
  foreground!: string;
  accent!: string;
  backgroundGradient!: string;

  themeName = signal('light-theme');
  themeService = inject(ThemeService);
  urlSub!: Subscription;
  themeSub!: Subscription;

  public authState = inject(AuthStateService);
  public profileService = inject(ProfileService);
  public currentUrl$!: Observable<string>;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object // Injected PLATFORM_ID
  ) {}
  title = 'client-interface';
  isNavExpanded = signal(false);
  isAuthenticated = signal(false);
  selectedProfile = signal<ProfileDto | null>(null);
  navItems = signal<NavItem[]>([]);

  ngOnInit() {
    this.currentUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects),
      startWith(this.router.url)
    );

    this.urlSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.router.url === '/') {
        if (!this.authState.isAuthenticated) {
          this.router.navigate(['/login']);
        }
      }
    });

    this.authState.isAuthenticated$.subscribe({
      next: (isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        if (isAuthenticated) {
          this.selectedProfile.set(this.profileService.getCurrentUserProfile());
        }
        this.updateNavItems();
      },
    });

    // Subscribe to currentUrl$ to update active state
    this.currentUrl$.subscribe(url => {
      this.updateNavItems();
    });

    // Initialize theme
    this.themeService.setTheme(this.themeService.getTheme());
    
    this.themeSub = this.themeService.themeColors$.subscribe((theme: ThemeColors | undefined) => {
      if (theme) {
        this.themeName.set(this.themeService.getTheme());
        this.background = theme.background;
        this.foreground = theme.foreground;
        this.accent = theme.accent;
        this.backgroundGradient = theme.accentGradients['light'];
      }
    });
  }
  ngOnDestroy() {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
    if (this.urlSub) {
      this.urlSub.unsubscribe();
    }
  }

  updateNavItems() {
    const currentUrl = this.router.url;
    if (this.isAuthenticated()) {
      this.navItems.set([
        {
          label: 'Logout',
          action: () => this.loginOutButton(),
        },
        {
          label: 'Profile',
          action: () => this.navigateTo('/profile'),
          isActive: currentUrl === '/profile',
        },
        {
          label: 'Feed',
          action: () => this.navigateTo('/feed'),
          isActive: currentUrl === '/feed',
        },
        {
          label: 'Tasks',
          action: () => this.navigateTo('/tasks'),
          isActive: currentUrl === '/tasks',
        },
      ]);
    } else {
      this.navItems.set([
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
    if (!this.authState.isAuthenticated) return;
    else this.isNavExpanded.set(!this.isNavExpanded());
  }

  navigateTo(path: string) {
    console.log(`Navigating to ${path}`);
    this.router.navigate([path]);
    this.isNavExpanded.set(false);
  }

  loginOutButton() {
    if (this.isAuthenticated()) {
      console.log('Logging out...');
      this.authState.logout();
      this.isAuthenticated.set(false);
      this.router.navigate(['/login']);
    } else {
      console.log('Navigating to login page...');
      this.router.navigate(['/login']);
    }
  }
}
