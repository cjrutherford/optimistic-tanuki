import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CurriculumPreviewComponent,
  CurriculumPreviewCourse,
  LandingHeroComponent,
  ValueProp,
  ValuePropsComponent,
} from '@optimistic-tanuki/learning-ui';
import { LearningDataService } from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';

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
  ],
  template: `
    <div class="page">
      <header class="topbar">
        <span class="brand">Let&rsquo;s Go</span>
        <nav>
          <button type="button" (click)="browse()">Courses</button>
          <!--
            The landing page has its own header rather than the studio layout,
            so links added to that layout do not appear here. This is the one
            page a stranger arrives on, and it was the only page from which
            the docs were unreachable.
          -->
          <button type="button" (click)="go('/about')">About</button>
          <button type="button" (click)="go('/docs')">Docs</button>
          @if (person()) {
          <button type="button" (click)="go('/dashboard')">
            Your progress
          </button>
          } @else {
          <button type="button" (click)="go('/sign-in')">Sign in</button>
          }
        </nav>
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
      .page {
        max-width: 68rem;
        margin: 0 auto;
        padding: 0 1.5rem 4rem;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.4rem 0;
      }
      .brand {
        font-family: var(--lx-font-heading);
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      nav {
        display: flex;
        gap: 0.4rem;
      }
      nav button {
        font: inherit;
        padding: 0.5rem 0.85rem;
        color: inherit;
        background: none;
        border: 1px solid transparent;
        border-radius: var(--lx-radius);
        cursor: pointer;
      }
      nav button:hover,
      nav button:focus-visible {
        border-color: var(--lx-border);
      }
      nav button:focus-visible {
        outline: 2px solid var(--lx-focus);
        outline-offset: 2px;
      }

      .closing {
        padding: 3.5rem 0 1rem;
        border-top: 1px solid var(--lx-border);
      }
      .closing h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        letter-spacing: -0.02em;
      }
      .closing p {
        margin: 0.7rem 0 1.6rem;
        max-width: 56ch;
        line-height: 1.65;
        color: var(--lx-text-muted);
      }
      .primary {
        font: inherit;
        font-weight: 600;
        padding: 0.8rem 1.4rem;
        border: 1px solid var(--lx-accent);
        border-radius: var(--lx-radius);
        background: var(--lx-accent);
        color: var(--lx-bg);
        cursor: pointer;
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
        margin-top: 3.5rem;
        padding-top: 1.4rem;
        border-top: 1px solid var(--lx-border);
        font-size: 0.85rem;
        color: var(--lx-text-muted);
      }
    `,
  ],
})
export class LandingComponent {
  private readonly router = inject(Router);
  private readonly data = inject(LearningDataService);
  private readonly auth = inject(LearningAuthService);

  // me() returns EMPTY on the server, so toSignal needs an initial value or
  // the first render has nothing to read.
  readonly person = toSignal(this.auth.me(), { initialValue: null });
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

  /**
   * Writing needs an account, so an unsigned visitor is sent to sign in
   * rather than to a page that will refuse them.
   */
  write() {
    this.router.navigateByUrl(this.person() ? '/author' : '/sign-in');
  }

  openCourse(offeringId: string) {
    this.router.navigate(['/course', offeringId]);
  }

  go(path: string) {
    this.router.navigateByUrl(path);
  }
}
