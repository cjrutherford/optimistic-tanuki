import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AppBarComponent,
  NavItem,
  NavSidebarComponent,
} from '@optimistic-tanuki/navigation-ui';
import { NavigationService } from '@optimistic-tanuki/app-registry';

@Component({
  selector: 'hai-title-bar',
  standalone: true,
  imports: [AppBarComponent, NavSidebarComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  readonly menuOpen = signal(false);
  readonly navItems: NavItem[] = [
    { label: 'Services', action: () => this.jump('#services') },
    { label: 'Personal Cloud', action: () => this.jump('#personal-cloud') },
    { label: 'Ecosystem', action: () => this.jump('#ecosystem') },
    { label: 'Contact', action: () => this.jump('#contact') },
    { label: 'HAI Computer', action: () => this.leave('system-configurator') },
  ];

  toggleMenu() {
    this.menuOpen.update((value) => !value);
  }

  jump(anchor: string) {
    if (this.router.url !== '/') {
      void this.router.navigateByUrl('/').then(() => {
        window.location.hash = anchor.replace('#', '');
      });
    } else {
      window.location.hash = anchor.replace('#', '');
    }
    this.menuOpen.set(false);
  }

  leave(appId: string) {
    this.navigation.navigate(appId);
  }
}
