import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CatalogEntry, navSections } from '../catalog-data';

@Component({
  selector: 'pg-index-chip',
  standalone: true,
  imports: [CommonModule],
  template: `<a class="chip" [attr.href]="fragmentHref">{{ label }}</a>`,
  styles: [
    `
      .chip {
        padding: 0.72rem 0.95rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: linear-gradient(
          180deg,
          rgba(18, 27, 42, 0.94),
          rgba(11, 18, 30, 0.96)
        );
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
        color: #cde2ff;
        text-decoration: none;
        font: 600 0.78rem/1 'IBM Plex Mono', monospace;
        transition: transform 160ms ease, border-color 160ms ease,
          background 160ms ease;

        &:hover {
          transform: translateY(-1px);
          border-color: rgba(125, 183, 255, 0.34);
          background: linear-gradient(
            180deg,
            rgba(22, 35, 56, 0.98),
            rgba(13, 21, 35, 0.98)
          );
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexChipComponent {
  @Input() id = '';
  @Input() label = '';

  get fragmentHref(): string {
    const path =
      typeof window === 'undefined'
        ? '/'
        : `${window.location.pathname}${window.location.search}` || '/';
    return `${path}#${this.id}`;
  }
}

@Component({
  selector: 'pg-nav-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="mobile-shell">
      <a class="mobile-logo" routerLink="/" (click)="closeMobileMenu()">
        <span class="mobile-logo-mark">UI</span>
        <span class="mobile-logo-copy">
          <strong>UI Playground</strong>
          <small>Components, docs, and validation</small>
        </span>
      </a>

      <button
        #mobileMenuToggle
        class="mobile-menu-toggle"
        type="button"
        [attr.aria-expanded]="mobileMenuOpen"
        aria-controls="playground-sidebar"
        aria-label="Toggle navigation menu"
        (click)="toggleMobileMenu()"
      >
        <span></span>
        <span></span>
      </button>
    </div>

    @if (mobileMenuOpen) {
    <button
      class="mobile-backdrop"
      type="button"
      aria-label="Close navigation menu"
      (click)="closeMobileMenu()"
    ></button>
    }

    <nav
      #sidebarPanel
      id="playground-sidebar"
      class="sidebar"
      [hidden]="!isSidebarVisible"
      [class.mobile-open]="mobileMenuOpen"
      [attr.aria-label]="'UI playground navigation'"
      [attr.aria-hidden]="!isSidebarVisible ? 'true' : null"
      [attr.tabindex]="mobileMenuOpen ? '-1' : null"
    >
      <div class="sidebar-inner">
        <a class="logo" routerLink="/" (click)="closeMobileMenu()">
          <span class="logo-mark">UI</span>
          <span class="logo-copy">
            <strong>UI Playground</strong>
            <small>Components, docs, and validation</small>
          </span>
        </a>

        <div class="sidebar-summary">
          <span class="summary-label">Navigation</span>
          <span class="summary-value">{{ libraries.length }}</span>
          <p>
            Use docs for guidance, component pages for previews, and validation
            for system checks.
          </p>
        </div>

        @for (section of sections; track section.title) {
        <section class="nav-group">
          <div class="nav-group-heading">
            <span class="nav-group-title">{{ section.title }}</span>
            <p>{{ section.description }}</p>
          </div>

          <div class="nav-section">
            @for (lib of section.entries; track lib.path) {
            <a
              class="nav-link"
              [routerLink]="lib.path"
              routerLinkActive="active"
              (click)="closeMobileMenu(true)"
            >
              <span class="nav-copy">
                <span class="lib-name">{{ lib.name }}</span>
                <span class="lib-meta">{{
                  lib.detail ?? lib.componentCount + ' components'
                }}</span>
              </span>
              <span class="count">{{ lib.componentCount }}</span>
            </a>
            }
          </div>
        </section>
        }
      </div>
    </nav>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .mobile-shell {
        position: sticky;
        top: 0;
        z-index: 140;
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid rgba(140, 175, 220, 0.14);
        background: linear-gradient(
            180deg,
            rgba(8, 13, 22, 0.98),
            rgba(8, 13, 22, 0.9)
          ),
          radial-gradient(
            circle at top left,
            rgba(125, 183, 255, 0.16),
            transparent 42%
          );
        backdrop-filter: blur(18px);
      }

      .mobile-logo,
      .logo {
        text-decoration: none;
        color: #fff;
      }

      .mobile-logo {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        min-width: 0;
      }

      .mobile-logo-mark,
      .logo-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.95rem;
        background: linear-gradient(
          135deg,
          rgba(125, 183, 255, 0.92),
          rgba(120, 240, 214, 0.78)
        );
        box-shadow: 0 16px 28px rgba(10, 22, 40, 0.35);
        color: #06101c;
        font: 700 0.82rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
      }

      .mobile-logo-copy,
      .logo-copy {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .mobile-logo-copy strong,
      .logo-copy strong {
        font-family: var(--font-heading);
        font-size: 1rem;
        letter-spacing: -0.03em;
      }

      .mobile-logo-copy small,
      .logo-copy small {
        color: var(--muted);
        font: 500 0.72rem/1.3 'IBM Plex Mono', monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .mobile-menu-toggle {
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.32rem;
        width: 2.9rem;
        height: 2.9rem;
        padding: 0;
        border: 1px solid rgba(140, 175, 220, 0.18);
        border-radius: 0.9rem;
        background: rgba(16, 26, 41, 0.78);
        cursor: pointer;
        flex-shrink: 0;
      }

      .mobile-menu-toggle span {
        display: block;
        width: 1.05rem;
        height: 2px;
        margin: 0 auto;
        border-radius: 999px;
        background: #e9f3ff;
      }

      .mobile-backdrop {
        position: fixed;
        inset: 0;
        z-index: 149;
        border: 0;
        background: rgba(3, 7, 14, 0.62);
        backdrop-filter: blur(3px);
      }

      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: 280px;
        padding: 1rem;
        border-right: 1px solid rgba(140, 175, 220, 0.14);
        background: linear-gradient(
            180deg,
            rgba(10, 17, 29, 0.98),
            rgba(6, 11, 20, 0.98)
          ),
          radial-gradient(
            circle at top left,
            rgba(125, 183, 255, 0.14),
            transparent 40%
          );
        overflow-y: auto;
        z-index: 150;
      }

      .sidebar-inner {
        display: grid;
        gap: 1rem;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 0.35rem 0.1rem 0.45rem;
      }

      .sidebar-summary {
        padding: 1rem 1rem 1.05rem;
        border: 1px solid rgba(140, 175, 220, 0.14);
        border-radius: 1.25rem;
        background: linear-gradient(
          180deg,
          rgba(19, 29, 45, 0.86),
          rgba(9, 15, 25, 0.96)
        );
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      .summary-label {
        display: block;
        margin-bottom: 0.45rem;
        color: color-mix(in srgb, var(--primary) 74%, white);
        font: 600 0.7rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .summary-value {
        display: block;
        margin-bottom: 0.55rem;
        font-family: var(--font-heading);
        font-size: 2rem;
        line-height: 0.92;
        letter-spacing: -0.05em;
      }

      .sidebar-summary p {
        margin: 0;
        color: var(--muted);
        font-size: 0.88rem;
        line-height: 1.55;
      }

      .nav-group {
        display: grid;
        gap: 0.65rem;
      }

      .nav-group + .nav-group {
        padding-top: 0.35rem;
        border-top: 1px solid rgba(129, 168, 222, 0.08);
      }

      .nav-group-heading {
        display: grid;
        gap: 0.3rem;
        padding: 0 0.2rem;
      }

      .nav-group-title {
        color: color-mix(in srgb, var(--primary) 78%, white);
        font: 600 0.7rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }

      .nav-group-heading p {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }

      .nav-section {
        display: grid;
        gap: 0.42rem;
      }

      .nav-link {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.8rem;
        padding: 0.85rem 0.95rem;
        border-radius: 1rem;
        border: 1px solid transparent;
        color: #c9dfff;
        text-decoration: none;
        transition: background 160ms ease, border-color 160ms ease,
          color 160ms ease, transform 160ms ease;

        &:hover {
          background: rgba(129, 168, 222, 0.08);
          border-color: rgba(129, 168, 222, 0.12);
          transform: translateX(2px);
        }

        &.active {
          background: linear-gradient(
            180deg,
            rgba(24, 41, 67, 0.9),
            rgba(13, 24, 40, 0.95)
          );
          border-color: rgba(125, 183, 255, 0.18);
          color: #fff;
        }
      }

      .nav-copy {
        display: grid;
        gap: 0.18rem;
        min-width: 0;
      }

      .lib-name {
        font-size: 0.92rem;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .lib-meta {
        color: var(--muted);
        font: 500 0.69rem/1.3 'IBM Plex Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .count {
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        padding: 0.34rem 0.46rem;
        border-radius: 0.58rem;
        background: rgba(129, 168, 222, 0.12);
        color: #ddecff;
      }

      @media (min-width: 961px) {
        .sidebar {
          transform: none !important;
        }
      }

      @media (max-width: 960px) {
        .mobile-shell {
          display: flex;
        }

        .sidebar {
          width: min(88vw, 320px);
          transform: translateX(-105%);
          transition: transform 220ms ease;
          box-shadow: 20px 0 60px rgba(0, 0, 0, 0.38);
        }

        .sidebar.mobile-open {
          transform: translateX(0);
        }

        .logo {
          display: none;
        }
      }

      @media (min-width: 961px) {
        .mobile-shell,
        .mobile-backdrop {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavSidebarComponent {
  @ViewChild('mobileMenuToggle')
  private readonly mobileMenuToggle?: ElementRef<HTMLButtonElement>;

  @ViewChild('sidebarPanel')
  private readonly sidebarPanel?: ElementRef<HTMLElement>;

  mobileMenuOpen = false;
  readonly sections = navSections;

  get isDesktopViewport(): boolean {
    return typeof window === 'undefined' ? true : window.innerWidth > 960;
  }

  get isSidebarVisible(): boolean {
    return this.isDesktopViewport || this.mobileMenuOpen;
  }

  get libraries(): CatalogEntry[] {
    return this.sections.flatMap((section) => [...section.entries]);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      this.sidebarPanel?.nativeElement.focus();
    }
  }

  closeMobileMenu(restoreFocus = false): void {
    this.mobileMenuOpen = false;

    if (restoreFocus) {
      this.mobileMenuToggle?.nativeElement.focus();
    }
  }

  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.mobileMenuOpen) {
      return;
    }

    event.preventDefault();
    this.closeMobileMenu(true);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth > 960) {
      this.closeMobileMenu();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    this.handleEscapeKey(event);
  }
}
