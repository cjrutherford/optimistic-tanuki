import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MessageComponent } from '@optimistic-tanuki/message-ui';
import { AuthStateService } from './services/auth-state.service';

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
    MessageComponent,
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

  title = 'local-hub';

  ngOnInit() {
    this.currentUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects),
      startWith(this.router.url)
    );

    this.authState.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe((isAuthenticated) => {
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
          label: 'Communities',
          action: () => this.navigateTo('/communities'),
          isActive: currentUrl.startsWith('/communities') || currentUrl.startsWith('/c/'),
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
          label: 'Communities',
          action: () => this.navigateTo('/communities'),
          isActive: currentUrl.startsWith('/communities') || currentUrl.startsWith('/c/'),
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
