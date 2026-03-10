import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';

interface RouteTitleConfig {
  path: string;
  title: string;
  prefix?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TitleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  private readonly defaultTitle = 'Optimistic Tanuki';
  private readonly routeTitles: RouteTitleConfig[] = [
    { path: '/feed', title: 'Feed' },
    { path: '/profile', title: 'Profile' },
    { path: '/settings', title: 'Settings' },
    { path: '/settings/privacy', title: 'Privacy Settings' },
    { path: '/messages', title: 'Messages' },
    { path: '/notifications', title: 'Notifications' },
    { path: '/explore', title: 'Explore' },
    { path: '/activity', title: 'Activity' },
    { path: '/communities', title: 'Communities' },
    { path: '/forum', title: 'Forum' },
    { path: '/login', title: 'Login' },
    { path: '/register', title: 'Register' },
  ];

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
        this.updateTitle(event.urlAfterRedirects);
      });

    this.updateTitle(this.router.url);
  }

  updateTitle(url: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    let title = this.defaultTitle;

    for (const route of this.routeTitles) {
      if (url === route.path || url.startsWith(route.path + '/')) {
        title = route.title;
        break;
      }
    }

    document.title = title;
  }

  setTitle(customTitle: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    document.title = customTitle;
  }

  setTitleWithDefault(customTitle: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    document.title = `${customTitle} | ${this.defaultTitle}`;
  }
}
