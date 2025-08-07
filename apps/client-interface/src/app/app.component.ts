/* eslint-disable @typescript-eslint/no-unused-vars */
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, inject, signal, ViewChild, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ProfileSelectorComponent } from '@optimistic-tanuki/profile-ui';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { ThemeColors } from '@optimistic-tanuki/common-ui';
import { Observable, Subscription, filter } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { AuthStateService } from './state/auth-state.service';
import { ToolbarComponent } from './components/toolbar.component';
import { GridComponent } from '@optimistic-tanuki/common-ui';
import { ProfileService } from './profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models'; // Added import for ProfileDto

/**
 * The root component of the client-interface application.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    ToolbarComponent,
    // ProfileSelectorComponent,
    GridComponent,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatDrawer;
  private breakpointObserver = inject(BreakpointObserver);
  /**
   * Observable that emits true if the screen is a handset, false otherwise.
   */
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  /**
   * The background color of the theme.
   */
  background!: string;
  /**
   * The foreground color of the theme.
   */
  foreground!: string;
  /**
   * The accent color of the theme.
   */
  accent!: string;
  /**
   * The background gradient of the theme.
   */
  backgroundGradient!: string;

  /**
   * Signal that holds the current theme name.
   */
  themeName = signal('light-theme');
  /**
   * The ThemeService instance.
   */
  themeService = inject(ThemeService);
  /**
   * Subscription for URL changes.
   */
  urlSub!: Subscription;
  /**
   * Subscription for theme changes.
   */
  themeSub!: Subscription;

  /**
   * The AuthStateService instance.
   */
  public authState = inject(AuthStateService);
  /**
   * The ProfileService instance.
   */
  public profileService = inject(ProfileService);
  /**
   * Observable that emits the current URL.
   */
  public currentUrl$!: Observable<string>;

  /**
   * Creates an instance of AppComponent.
   * @param router The Angular router.
   * @param platformId The platform ID.
   */
  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object // Injected PLATFORM_ID
  ) {}
  /**
   * The title of the application.
   */
  title = 'client-interface';
  /**
   * Indicates whether the navigation is expanded.
   */
  isNavExpanded = false;

  /**
   * Initializes the component.
   */
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

    // this.profileService.getAllProfiles().then((profiles: ProfileDto[] | void) => { // Used ProfileDto[] | void
    //   // Added isPlatformBrowser check
    //   if (isPlatformBrowser(this.platformId)) {
    //     const selectedProfile = localStorage.getItem('selectedProfile');
    //     if (selectedProfile) {
    //       this.profileService.selectProfile(JSON.parse(selectedProfile));
    //     }
    //   }
    // });

    this.themeSub = this.themeService.themeColors$.subscribe((theme: ThemeColors | undefined) => {
      if (theme) {
        this.themeName.set(this.themeService.getTheme());
        this.background = theme.background;
        this.foreground = theme.foreground;
      }
    });
  }
  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
    if (this.urlSub) {
      this.urlSub.unsubscribe();
    }
  }

  /**
   * Toggles the navigation drawer.
   */
  toggleNav() {
    if (!this.authState.isAuthenticated) return;
    else this.isNavExpanded = !this.isNavExpanded;
  }
}
