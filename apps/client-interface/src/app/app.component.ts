/* eslint-disable @typescript-eslint/no-unused-vars */
import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Observable, Subscription, filter } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { AuthStateService } from './state/auth-state.service';
import { CardComponent, ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
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
    CardComponent,
    ButtonComponent,
    ModalComponent,
    ThemeToggleComponent,
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

    this.authState.isAuthenticated$().subscribe({
      next: (isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        if (isAuthenticated) {
          this.selectedProfile.set(this.profileService.getCurrentUserProfile());
        }
      },
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
