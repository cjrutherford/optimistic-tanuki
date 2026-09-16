import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CurriculumPreviewComponent,
  CurriculumPreviewCourse,
  LandingHeroComponent,
  ValueProp,
  ValuePropsComponent,
} from '@optimistic-tanuki/learning-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { LearningDataService } from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';
import { ChallengePanelComponent } from './challenge-panel.component';

/**
 * The front door.
 *
 * The app used to open onto the catalog, which answers "what is here" for
 * somebody who already knows they want it and answers nothing for anybody
 * else. Every one of the four repositories this platform was ported from had
 * a landing page; the port took their lessons and left the argument behind.
 *
 * This page is not in the studio layout on purpose. The sidebar exists to move
 * around inside a course, and showing it to somebody who has not chosen one
 * yet is showing them the controls before the reason.
 */
@Component({
  selector: 'learning-landing',
  imports: [
    LandingHeroComponent,
    ValuePropsComponent,
    CurriculumPreviewComponent,
    ChallengePanelComponent,
    ThemeToggleComponent,
    RouterLink,
  ],
  template: `
    <div class="page">
      <header class="topbar">
        <span class="brand">Let&rsquo;s Go</span>
        <div class="topbar-actions">
          <learning-challenge-panel
            (opened)="closeMenu()"
          ></learning-challenge-panel>
          <button
            type="button"
            #menuToggle
            class="menu-toggle"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="learning-landing-menu"
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
          id="learning-landing-menu"
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
              @if (person()) {
              <span class="who">Signed in as {{ person()?.name }}</span>
              <a routerLink="/author" (click)="closeMenu()">Write a course</a>
              <button type="button" (click)="signOut()">Sign out</button>
              } @else {
              <span class="who">Reading is open to everyone.</span>
              <a
                routerLink="/sign-in"
                [queryParams]="{ returnTo: currentPath }"
                (click)="closeMenu()"
                >Sign in</a
              >
              }
            </div>
          </div>
        </section>
      </header>

      <main>
        <otlearn-landing-hero
          eyebrow="Learn something worth knowing"
          headline="Get better at the work you actually do."
          subhead="Courses on any subject, written by people who do the thing.
            Read a lesson, do the work, and have it marked against what the
            author was actually asking for."
          reassurance="Every course is readable without an account. You only
            need one when you want your progress kept."
          primaryLabel="Browse courses"
          secondaryLabel="Write a course"
          [sampleLesson]="sample()"
          (browse)="browse()"
          (write)="write()"
        ></otlearn-landing-hero>

        <otlearn-value-props
          heading="What this does that a page of notes does not"
          [props]="props"
        ></otlearn-value-props>

        <otlearn-curriculum-preview
          heading="What is here right now"
          [subheading]="catalogSummary()"
          [courses]="courses()"
          (open)="openCourse($event)"
        ></otlearn-curriculum-preview>

        <section class="closing">
          <h2>Know something worth teaching?</h2>
          <p>
            Anyone can write a course here. Set the work, say what a good answer
            looks like, and publish it when you are ready.
          </p>
          <button type="button" class="primary" (click)="write()">
            Write a course
          </button>
        </section>
      </main>

      <footer>
        <span>Let&rsquo;s Go</span>
        <span>Read freely. Enrol when it is worth keeping.</span>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background-color: var(--lx-bg);
        background-image: var(--lx-page-pattern);
        background-attachment: fixed;
      }
      .page {
        max-width: 68rem;
        margin: 0 auto;
        padding: 0 1.5rem 4rem;
      }
      .topbar {
        --learning-topbar-height: 4.25rem;
        position: relative;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.4rem 0;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .topbar-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.55rem;
        flex-wrap: wrap;
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
        transition: var(--lx-btn-transition);
      }
      .topbar-sheet.is-open {
        max-height: min(
          28rem,
          max(0px, calc(100dvh - var(--learning-topbar-height)))
        );
        overflow-y: auto;
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
        border-width: 0 var(--lx-border-width) var(--lx-border-width);
        box-shadow: var(--lx-shadow-card);
        pointer-events: auto;
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
      .brand {
        font-family: var(--lx-font-heading);
        font-weight: 800;
        font-size: 1.15rem;
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      nav {
        display: flex;
        gap: 0.4rem;
      }
      nav button {
        font-family: var(--lx-font-mono, monospace);
        font-size: 0.82rem;
        font-weight: 600;
        text-transform: var(--lx-btn-transform, uppercase);
        letter-spacing: 0.05em;
        padding: 0.5rem 0.85rem;
        color: inherit;
        background: none;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-radius: var(--lx-radius);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      nav button:hover {
        border-color: var(--lx-border-soft);
        background: var(--lx-surface-hover);
      }
      nav button:focus-visible {
        outline: 2px solid var(--lx-focus);
        outline-offset: 2px;
        border-color: var(--lx-focus);
      }
      nav button:active {
        transform: translate(1px, 1px);
      }

      .closing {
        padding: 4rem 0 1rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .closing h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        letter-spacing: -0.02em;
      }
      .closing p {
        margin: 0.7rem 0 1.8rem;
        max-width: 56ch;
        line-height: 1.65;
        color: var(--lx-text-muted);
      }
      .primary {
        font-family: var(--lx-font-mono, monospace);
        font-size: 0.88rem;
        font-weight: var(--lx-btn-weight, 800);
        text-transform: var(--lx-btn-transform, uppercase);
        letter-spacing: 0.06em;
        padding: 0.8rem 1.4rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        background: var(--lx-accent);
        color: var(--lx-bg);
        cursor: pointer;
        box-shadow: var(--lx-shadow-sm);
        transition: var(--lx-btn-transition);
      }
      .primary:hover {
        opacity: 0.92;
        box-shadow: var(--lx-shadow-control);
      }
      .primary:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .primary:focus-visible {
        outline: 2px solid var(--lx-focus);
        outline-offset: 2px;
      }

      footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.5rem;
        justify-content: space-between;
        margin-top: 4rem;
        padding-top: 1.5rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        font-family: var(--lx-font-mono, monospace);
        font-size: 0.8rem;
        color: var(--lx-text-muted);
      }
      @media (max-width: 760px) {
        .topbar {
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .topbar-actions {
          flex: 1 1 100%;
          justify-content: space-between;
        }
        .topbar-sheet {
          position: fixed;
          top: var(--learning-topbar-height);
          right: 0.5rem;
          left: 0.5rem;
          width: auto;
        }
      }
    `,
  ],
})
export class LandingComponent {
  private readonly router = inject(Router);
  private readonly data = inject(LearningDataService);
  private readonly auth = inject(LearningAuthService);
  @ViewChild('menuToggle')
  private readonly menuToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild(ChallengePanelComponent)
  private readonly challengePanel?: ChallengePanelComponent;

  // me() returns EMPTY on the server, so toSignal needs an initial value or
  // the first render has nothing to read.
  readonly person = toSignal(this.auth.me(), { initialValue: null });
  readonly menuOpen = signal(false);
  private readonly tracks = toSignal(this.data.catalog());
  private readonly serverSubjects = toSignal(this.data.subjects());

  /**
   * Claims a reader could check, rather than the ones marketing reaches for.
   * Each of these is a thing the platform demonstrably does.
   */
  readonly props: ValueProp[] = [
    {
      title: 'The work is marked, not just collected',
      body: 'Written answers are marked against the rubric the author wrote, and the marker has to quote your own words to award anything. Code is compiled and run on a server, so passing means it actually ran.',
    },
    {
      title: 'Read first, sign up later',
      body: 'Every published course is readable without an account. Enrol when you want your progress kept, which is the first point where an account is genuinely needed.',
    },
    {
      title: 'Anyone can teach here',
      body: 'Writing a course is part of the product, not a favour from an administrator. Set your own work, say what a good answer looks like, publish when it is ready.',
    },
  ];

  /**
   * A real lesson from the live catalog, not an invented one.
   *
   * Picking the first lesson of the first published course means this cannot
   * advertise something that is not there. If the catalog is empty the hero
   * simply has no sample rather than a placeholder.
   */
  readonly sample = computed(() => {
    for (const track of this.tracks() ?? []) {
      for (const offering of track.offerings) {
        if (offering.status !== 'published') continue;
        const lesson = offering.modules.flatMap((module) => module.lessons)[0];
        if (!lesson) continue;
        return {
          courseName: offering.displayName,
          lessonTitle: lesson.title,
          excerpt:
            offering.audience ??
            offering.description ??
            'Open it and see what it covers.',
        };
      }
    }
    return null;
  });

  readonly courses = computed<CurriculumPreviewCourse[]>(() => {
    const subjectNames = new Map(
      (this.serverSubjects() ?? []).map((subject) => [
        subject.subjectId,
        subject.displayName,
      ])
    );
    return (this.tracks() ?? []).flatMap((track) =>
      track.offerings
        .filter((offering) => offering.status === 'published')
        .map((offering) => ({
          offeringId: offering.id,
          displayName: offering.displayName,
          audience: offering.audience ?? offering.description ?? '',
          lessonCount: offering.modules.reduce(
            (total, module) => total + module.lessons.length,
            0
          ),
          subjectName:
            subjectNames.get(offering.subjectId) ?? offering.subjectId,
        }))
    );
  });

  readonly catalogSummary = computed(() => {
    const count = this.courses().length;
    if (count === 0) return '';
    const subjects = new Set(this.courses().map((course) => course.subjectName))
      .size;
    return `${count} ${count === 1 ? 'course' : 'courses'} across ${subjects} ${
      subjects === 1 ? 'subject' : 'subjects'
    }.`;
  });

  browse() {
    this.router.navigateByUrl('/courses');
  }

  get currentPath(): string {
    return this.router.url.split('?')[0] || '/';
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

  signOut(): void {
    this.closeMenu();
    this.auth.logout().subscribe(() => {
      this.router.navigateByUrl('/').then(() => location.reload());
    });
  }

  /**
   * Writing needs an account, so an unsigned visitor is sent to sign in
   * rather than to a page that will refuse them.
   */
  write() {
    this.router.navigateByUrl(this.person() ? '/author' : '/sign-in');
  }

  openCourse(offeringId: string) {
    this.router.navigateByUrl(`/course/${offeringId}`);
  }

  go(path: string) {
    this.router.navigateByUrl(path);
  }
}
