import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthStateService } from './auth-state.service';
import { Subscription, filter } from 'rxjs';
import { NotificationBellComponent } from '@optimistic-tanuki/notification-ui';
import { ParallaxGridWarpComponent } from '@optimistic-tanuki/motion-ui';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';

@Component({
  imports: [
    CommonModule,
    RouterModule,
    NotificationBellComponent,
    ParallaxGridWarpComponent,
    HaiAboutTagComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  protected title = 'opportunity-compass';
  readonly haiAboutConfig = {
    appId: 'opportunity-compass',
    appName: 'Opportunity Compass',
    appTagline: 'Opportunity discovery from interests, locality, and skills.',
    appDescription:
      'Opportunity Compass helps users discover potential opportunities by combining their interests, local context, skills, and onboarding profile into a focused discovery workspace.',
    appUrl: '/opportunity-compass',
  };
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  isDark = false;
  isOnboardingRoute = false;
  isAuthenticated = false;
  currentProfileName = '';
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  readonly notificationItems = this.notifications;
  readonly unreadNotificationCount = this.unreadCount;
  private readonly subscriptions = new Subscription();

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

  get brandRoute(): string {
    if (this.isOnboardingRoute) {
      return '/onboarding';
    }

    return this.isAuthenticated ? '/leads' : '/login';
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setPersonality('control-center');
      this.isDark = this.themeService.getTheme() === 'dark';
      this.isOnboardingRoute = this.router.url.startsWith('/onboarding');
      this.subscriptions.add(
        this.themeService.theme$().subscribe((theme) => {
          this.isDark = theme === 'dark';
        })
      );
      this.subscriptions.add(
        this.authState.isAuthenticated$.subscribe((value) => {
          this.isAuthenticated = value;
          if (!value) {
            this.currentProfileName = '';
          }
        })
      );
      this.subscriptions.add(
        this.authState.currentProfile$.subscribe((profile) => {
          this.currentProfileName = profile?.profileName || '';
        })
      );
      this.subscriptions.add(
        this.router.events
          .pipe(
            filter(
              (event): event is NavigationEnd => event instanceof NavigationEnd
            )
          )
          .subscribe((event) => {
            this.isOnboardingRoute =
              event.urlAfterRedirects.startsWith('/onboarding');
          })
      );
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async logout() {
    this.authState.logout();
    await this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
