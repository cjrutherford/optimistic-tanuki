import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavItem, NavSidebarComponent } from '@optimistic-tanuki/navigation-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { NavigationService } from '@optimistic-tanuki/app-registry';

@Component({
  selector: 'hai-title-bar',
  standalone: true,
  imports: [CommonModule, NavSidebarComponent, ThemeToggleComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  readonly menuOpen = signal(false);
  readonly navItems: NavItem[] = [
    { label: 'Home', action: () => this.jump('#') },
    { label: 'Turn-key Appliances', action: () => this.jump('#appliances') },
    { label: 'Software Stacks', action: () => this.jump('#stacks') },
    { label: 'Cost Comparison', action: () => this.jump('#comparison') },
    { label: 'Contact', action: () => this.jump('#contact') },
  ];

  readonly navLinks = [
    { label: 'Home', href: '#' },
    { label: 'Turn-key Appliances', href: '#appliances' },
    { label: 'Software Stacks', href: '#stacks' },
    { label: 'Cost Comparison', href: '#comparison' },
    { label: 'Contact', href: '#contact' },
  ];

  toggleMenu() {
    this.menuOpen.update((value) => !value);
  }

  jump(anchor: string) {
    const target = anchor.replace('#', '');
    if (this.router.url !== '/') {
      void this.router.navigateByUrl('/').then(() => {
        this.scrollToTarget(target);
      });
    } else {
      this.scrollToTarget(target);
    }
    this.menuOpen.set(false);
  }

  onNavClick(event: Event, href: string) {
    event.preventDefault();
    this.jump(href);
  }

  private scrollToTarget(target: string) {
    if (typeof window === 'undefined') return;
    if (!target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.location.hash = '';
      return;
    }
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.location.hash = target;
  }

  leave(appId: string) {
    this.navigation.navigate(appId);
  }
}
