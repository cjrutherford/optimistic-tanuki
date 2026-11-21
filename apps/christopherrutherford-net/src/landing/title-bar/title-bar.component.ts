import {
  Component,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';

import { PROFILE } from '../profile.data';
import { SectionScrollService } from '../section-scroll.service';

@Component({
  selector: 'app-title-bar',
  imports: [AppBarComponent, NavSidebarComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly sectionScroll = inject(SectionScrollService);

  menuOpen = signal(false);
  navItems: NavItem[] = [
    { label: 'Work', action: () => this.navigateTo('#work') },
    { label: 'Experience', action: () => this.navigateTo('#experience') },
    { label: 'About', action: () => this.navigateTo('#about') },
    { label: 'Consulting', action: () => this.navigateTo('#work-together') },
    { label: 'Contact', action: () => this.navigateTo('#contact') },
    { label: 'Résumé (PDF)', action: () => this.openResume() },
  ];

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  /**
   * Updates the URL fragment through the router and scrolls the section into
   * view. The scroll waits for the next render: closing the drawer releases
   * the modal's body scroll lock, which would otherwise reset the position.
   * The target's `scroll-margin-top` clears the app bar, and the scroll is
   * instant when the visitor has asked for reduced motion.
   */
  navigateTo(anchor: string) {
    const fragment = anchor.replace(/^#/, '');
    this.menuOpen.set(false);
    afterNextRender(() => this.sectionScroll.scrollTo(fragment), {
      injector: this.injector,
    });
    void this.router.navigate([], { fragment });
  }

  openResume() {
    this.menuOpen.set(false);
    window.open(PROFILE.links.resume, '_blank', 'noopener');
  }
}
