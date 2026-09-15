import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { LearningDataService } from './learning-data.service';
import { LearningAuthService, SignedInPerson } from './learning-auth.service';
import { ChallengePanelComponent } from './challenge-panel.component';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'learning-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    AsyncPipe,
    ChallengePanelComponent,
    ThemeToggleComponent,
  ],
  template: ` <header class="topbar">
      <a routerLink="/" class="brand-link">Let&rsquo;s Go</a>
      <span class="tagline">Learn anything, in the open</span>
      <!--
        The only place the app says who you are, and the only way in for
        somebody who is not signed in. Reading is open to everyone, so this is
        an invitation rather than a gate.
      -->
      <span class="session">
        <a routerLink="/about">About</a>
        <a routerLink="/docs">Docs</a>
        @if (person(); as signedIn) {
        <span class="who">{{ signedIn.name }}</span>
        <a routerLink="/author">Write</a>
        <button type="button" (click)="signOut()">Sign out</button>
        } @else {
        <a routerLink="/sign-in" [queryParams]="{ returnTo: currentPath() }"
          >Sign in</a
        >
        }
      </span>
      <div class="topbar-actions">
        <learning-challenge-panel
          [trackId]="trackId"
          (opened)="closeMenu()"
        ></learning-challenge-panel>
        <button
          type="button"
          #menuToggle
          class="menu-toggle"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="learning-topbar-sheet"
          [attr.aria-label]="
            menuOpen() ? 'Close navigation menu' : 'Open navigation menu'
          "
          (click)="toggleMenu()"
        >
          <span class="pull-tab" aria-hidden="true"></span>
          <span>{{ menuOpen() ? 'Close' : 'Menu' }}</span>
        </button>
      </div>

      <section
        id="learning-topbar-sheet"
        class="topbar-sheet"
        [class.is-open]="menuOpen()"
        [attr.aria-hidden]="!menuOpen()"
        [attr.inert]="menuOpen() ? null : ''"
      >
        <div class="sheet-inner">
          <div class="sheet-heading">
            <span>Quick access</span>
            <button
              type="button"
              class="sheet-dismiss"
              (click)="closeMenu(true)"
            >
              Close
            </button>
          </div>
          <nav class="sheet-nav" aria-label="Site navigation">
            <a routerLink="/courses" (click)="closeMenu()">Browse courses</a>
            <a routerLink="/dashboard" (click)="closeMenu()">Your progress</a>
            <a routerLink="/about" (click)="closeMenu()">About</a>
            <a routerLink="/docs" (click)="closeMenu()">Docs</a>
          </nav>
          <div class="sheet-appearance">
            <lib-theme-toggle></lib-theme-toggle>
          </div>
          <div class="sheet-session">
            @if (person(); as signedIn) {
            <span class="who">Signed in as {{ signedIn.name }}</span>
            <a routerLink="/author" (click)="closeMenu()">Write a course</a>
            <button type="button" (click)="signOut()">Sign out</button>
            } @else {
            <span class="who">Reading is open to everyone.</span>
            <a
              routerLink="/sign-in"
              [queryParams]="{ returnTo: currentPath() }"
              (click)="closeMenu()"
              >Sign in</a
            >
            }
          </div>
        </div>
      </section>
    </header>
    <div class="studio">
      <aside aria-label="Course navigation">
        <a routerLink="/courses" class="brand">Catalog</a>
        <nav>
          <a
            routerLink="/courses"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Browse courses</a
          ><a routerLink="/dashboard" routerLinkActive="active"
            >Your progress</a
          >
          <!--
            Modules appear only for the course being read. This sidebar used to
            list every module of every track on every page, which is forty
            entries before a visitor has chosen anything.
          -->
          @if (trackId) {@if (dashboard$ | async; as paths) {@for (path of
          paths; track path.offeringId ?? path.program.offerings[0].id) {@if
          (path.program.id === trackId) {
          <p>{{ path.program.displayName }}</p>
          @for (offering of path.program.offerings; track offering.id) { @if
          (!offeringId || offering.id === offeringId) { @for (module of
          offering.modules; track module.id) {<a
            [routerLink]="['/module', path.program.id, module.id]"
            [queryParams]="{ offeringId: offering.id }"
            routerLinkActive="active"
            >{{ module.title }}</a
          >}}}}}}}
        </nav>
      </aside>
      <main><ng-content></ng-content></main>
    </div>`,
  styles: [
    `
      .topbar {
        --learning-topbar-height: 4.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: var(--learning-topbar-height);
        padding: 0.85rem 1.3rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        background-color: var(--lx-bg);
        background-image: var(--lx-page-pattern);
        color: var(--lx-text-subtle);
        font: 0.72rem var(--lx-font-mono, ui-monospace, monospace);
        position: relative;
        z-index: 100;
        box-sizing: border-box;
      }
      .topbar > .brand-link {
        color: var(--lx-accent);
        font-weight: var(--lx-btn-weight, 800);
        text-decoration: none;
        letter-spacing: 0.05em;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition);
      }
      .topbar > .brand-link:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .tagline {
        flex: 1;
        color: var(--lx-text-faint);
        font-size: 0.7rem;
      }
      .session {
        display: flex;
        gap: 0.8rem;
        align-items: center;
      }
      .session .who {
        color: var(--lx-text);
        font-weight: 700;
      }
      .session a {
        color: var(--lx-accent);
        text-decoration: none;
        font-weight: var(--lx-btn-weight, 600);
        text-transform: var(--lx-btn-transform, uppercase);
        font-size: 0.72rem;
        transition: var(--lx-btn-transition);
      }
      .session a:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .session button {
        border: 0;
        background: transparent;
        color: var(--lx-text-muted);
        font: inherit;
        font-weight: var(--lx-btn-weight, 600);
        text-transform: var(--lx-btn-transform, uppercase);
        font-size: 0.72rem;
        border-radius: var(--lx-radius);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .session button:hover {
        color: var(--lx-text);
      }
      .session button:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .topbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        margin-left: auto;
      }
      .menu-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 2.35rem;
        padding: 0.45rem 0.7rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-text);
        font: var(--lx-btn-weight) 0.7rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
        box-shadow: var(--lx-shadow-sm);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .pull-tab {
        display: block;
        width: 0.9rem;
        height: 0.35rem;
        border: var(--lx-border-width) var(--lx-border-style) currentColor;
        border-bottom: 0;
        transform: translateY(-0.15rem);
      }
      .menu-toggle:hover {
        border-color: var(--lx-accent);
        background: var(--lx-surface-hover);
      }
      .menu-toggle:active,
      .menu-toggle[aria-expanded='true'] {
        transform: translate(1px, 1px);
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-inset);
      }
      .menu-toggle:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .topbar-sheet {
        position: absolute;
        z-index: 110;
        top: 100%;
        right: 0;
        left: 0;
        max-height: 0;
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
        transform: translateY(-0.5rem);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        border: 0 var(--lx-border-style) var(--lx-border-soft);
        box-shadow: none;
        pointer-events: none;
        transition: max-height var(--animation-duration-fast, 100ms)
            var(--animation-easing, steps(2)),
          opacity var(--animation-duration-fast, 100ms)
            var(--animation-easing, steps(2)),
          transform var(--animation-duration-fast, 100ms)
            var(--animation-easing, steps(2)),
          visibility 0s linear var(--animation-duration-fast, 100ms);
      }
      .topbar-sheet.is-open {
        max-height: min(
          28rem,
          max(0px, calc(100dvh - var(--learning-topbar-height)))
        );
        overflow-y: auto;
        overscroll-behavior: contain;
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
        border-width: 0 var(--lx-border-width) var(--lx-border-width);
        box-shadow: var(--lx-shadow-card);
        pointer-events: auto;
        transition-delay: 0s;
      }
      .sheet-inner {
        display: grid;
        gap: 1rem;
        max-width: 68rem;
        margin: 0 auto;
        padding: 1rem 1.3rem 1.2rem;
      }
      .sheet-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.7rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        color: var(--lx-text-subtle);
        font: var(--lx-btn-weight) 0.68rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.12em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .sheet-dismiss {
        padding: 0.35rem 0.55rem;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-radius: var(--lx-radius);
        background: transparent;
        color: var(--lx-text-muted);
        font: inherit;
        text-transform: inherit;
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .sheet-dismiss:hover {
        border-color: var(--lx-border-soft);
        color: var(--lx-text);
      }
      .sheet-dismiss:focus-visible,
      .sheet-nav a:focus-visible,
      .sheet-session a:focus-visible,
      .sheet-session button:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .sheet-nav {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 0.5rem;
      }
      .sheet-nav a,
      .sheet-session a,
      .sheet-session button {
        display: flex;
        align-items: center;
        min-height: 2.6rem;
        padding: 0.65rem 0.75rem;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-radius: var(--lx-radius);
        color: var(--lx-text);
        font: var(--lx-btn-weight) 0.72rem/1.3 var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-decoration: none;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition);
      }
      .sheet-nav a:hover,
      .sheet-session a:hover,
      .sheet-session button:hover {
        border-color: var(--lx-border-soft);
        background: var(--lx-surface-hover);
      }
      .sheet-session {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding-top: 0.85rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .sheet-session .who {
        flex: 1 1 100%;
        color: var(--lx-text-muted);
        font-size: 0.75rem;
      }
      .sheet-session button {
        background: transparent;
        cursor: pointer;
      }
      @media (prefers-reduced-motion: reduce) {
        .topbar-sheet {
          transition: none;
        }
      }
      .studio {
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        min-height: calc(100vh - 45px);
        background-color: var(--lx-bg);
        background-image: var(--lx-page-pattern);
        background-attachment: fixed;
        color: var(--lx-text-body);
      }
      .studio aside {
        padding: 1.25rem 0.75rem;
        border-right: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-sm);
      }
      .brand {
        display: block;
        padding: 0.6rem 0.7rem;
        color: var(--lx-accent);
        font-weight: var(--lx-btn-weight, 800);
        text-decoration: none;
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition);
      }
      .brand:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: -2px;
      }
      .studio nav {
        display: grid;
        gap: 0.2rem;
        margin-top: 1.25rem;
      }
      .studio nav p {
        margin: 1.1rem 0.7rem 0.25rem;
        color: var(--lx-text-subtle);
        font: 700 0.65rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.09em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .studio nav a {
        padding: 0.55rem 0.7rem;
        color: var(--lx-text-muted);
        text-decoration: none;
        font-size: 0.84rem;
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          transparent;
        border-radius: 0 var(--lx-radius) var(--lx-radius) 0;
        transition: var(--lx-btn-transition);
      }
      .studio nav a:hover {
        background: var(--lx-surface-hover);
        color: var(--lx-text);
      }
      .studio nav a:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: -2px;
      }
      .studio nav a.active {
        background: var(--lx-surface-active);
        color: var(--lx-text);
        border-left-color: var(--lx-accent);
        font-weight: 700;
      }
      .studio main {
        min-width: 0;
        padding: 2.25rem;
        background: transparent;
      }
      @media (max-width: 760px) {
        /*
          Only the tagline goes. This used to hide every span in the bar,
          which took the whole session block with it once one was added:
          on a phone there was no way to sign in, sign out, or reach Write.
        */
        .tagline {
          display: none;
        }
        .session {
          display: none;
        }
        .topbar-actions {
          margin-left: auto;
        }
        .topbar-sheet {
          position: fixed;
          top: var(--learning-topbar-height);
          right: 0.5rem;
          left: 0.5rem;
          width: auto;
        }
        .studio {
          display: block;
        }
        .studio aside {
          border-right: 0;
          border-bottom: var(--lx-border-width) var(--lx-border-style)
            var(--lx-border-soft);
          overflow: auto;
          box-shadow: var(--lx-shadow-sm);
        }
        .studio nav {
          display: flex;
          width: max-content;
        }
        .studio nav p {
          display: none;
        }
        .studio main {
          padding: 1.3rem;
        }
      }
    `,
  ],
})
export class LearningLayoutComponent {
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);
  @ViewChild('menuToggle')
  private readonly menuToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild(ChallengePanelComponent)
  private readonly challengePanel?: ChallengePanelComponent;

  /**
   * Where the reader is now, handed to the sign-in page so it can put them
   * back. Reading is open to anyone, so this link is most often clicked from
   * the middle of a lesson, and dropping them at the catalog afterwards made
   * them find their place again by hand.
   */
  readonly currentPath = () => {
    const current = this.router.url;
    return current.startsWith('/') && !current.startsWith('//')
      ? current
      : '/courses';
  };

  readonly person = signal<SignedInPerson | null>(null);
  readonly menuOpen = signal(false);

  constructor() {
    this.auth.me().subscribe((person) => this.person.set(person));
  }

  toggleMenu(): void {
    if (!this.menuOpen()) this.challengePanel?.close();
    this.menuOpen.update((open) => !open);
  }

  closeMenu(restoreFocus = false): void {
    const wasOpen = this.menuOpen();
    this.menuOpen.set(false);

    if (restoreFocus && wasOpen) {
      this.menuToggle?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu(true);
  }

  protected signOut(): void {
    this.closeMenu();
    this.auth.logout().subscribe(() => {
      this.person.set(null);
      // The landing page, which is the right place for somebody with no
      // session. A full reload, because everything on the page was fetched as
      // the person who is now signed out.
      this.router.navigateByUrl('/').then(() => location.reload());
    });
  }

  /**
   * The course being read, if any.
   *
   * Absent on the catalog and the dashboard, which is what keeps the module
   * list out of the way until somebody has chosen something.
   */
  @Input() trackId = '';
  @Input() offeringId = '';

  readonly dashboard$ = inject(LearningDataService).dashboard();
}
