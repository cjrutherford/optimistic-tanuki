import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';
import {
  AppShellNavLink,
  NavItem,
  NavSidebarComponent,
} from '@optimistic-tanuki/navigation-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { HEADER_LINKS, SITE_NAVIGATION } from '../../content/navigation';

@Component({
  selector: 'hai-title-bar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NavSidebarComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly headerLinks = HEADER_LINKS;
  readonly navItems = signal<NavItem[]>(this.buildNavItems(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(() => this.navItems.set(this.buildNavItems(this.router.url)));
  }

  toggleMenu() {
    this.menuOpen.update((value) => !value);
  }

  private buildNavItems(currentUrl: string): NavItem[] {
    const path = currentUrl.split(/[?#]/)[0] || '/';

    const toItem = (link: AppShellNavLink): NavItem => {
      const children = link.children?.map(toItem);
      const isActive =
        (children?.some((child) => child.isActive) ?? false) ||
        (!!link.route &&
          (link.exact
            ? path === link.route
            : path === link.route || path.startsWith(`${link.route}/`)));

      return {
        label: link.label,
        isActive,
        action: link.route
          ? () => void this.router.navigateByUrl(link.route as string)
          : undefined,
        children,
      };
    };

    return SITE_NAVIGATION.map(toItem);
  }
}
