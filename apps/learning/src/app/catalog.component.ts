import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import {
  CourseCardComponent,
  SubjectNavComponent,
  SubjectNavItem,
} from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import {
  CatalogOffering,
  CatalogTrack,
  LearningDataService,
} from './learning-data.service';

interface CatalogRow {
  offeringId: string;
  trackId: string;
  subjectIds: string[];
  displayName: string;
  description: string;
  variantLabel: string;
  isDraft: boolean;
  lessonCount: number;
  credits: number;
  level: number;
}

/**
 * The entrance.
 *
 * A visitor used to arrive at a list of four programming languages and go
 * straight from there into a course's module sidebar. This asks what they are
 * interested in first, and shows what each course is before they open it.
 *
 * The copy says nothing about programming: the four ported tracks are examples
 * of what this platform holds, not what it is.
 */
@Component({
  selector: 'learning-catalog',
  imports: [
    LearningLayoutComponent,
    LoadingStateComponent,
    SubjectNavComponent,
    CourseCardComponent,
    RouterLink,
  ],
  template: `<learning-layout>
    @if (tracks(); as loaded) {
    <header>
      <p class="eyebrow">Catalog</p>
      <h1>Learn something.</h1>
      <p class="lede">
        {{ summary() }}
      </p>
    </header>

    <otlearn-subject-nav
      [subjects]="subjects()"
      [selected]="selectedSubject()"
      (select)="selectedSubject.set($event)"
    ></otlearn-subject-nav>

    @if (visibleRows().length) {
    <section class="courses" aria-label="Courses">
      @for (row of visibleRows(); track row.offeringId) {
      <a class="course" [routerLink]="['/course', row.offeringId]">
        <otlearn-course-card
          [displayName]="row.displayName"
          [description]="row.description"
          [variantLabel]="row.variantLabel"
          [isDraft]="row.isDraft"
          [lessonCount]="row.lessonCount"
          [credits]="row.credits"
          [level]="row.level"
        ></otlearn-course-card>
      </a>
      }
    </section>
    } @else {
    <p class="empty">{{ emptyMessage() }}</p>
    } } @else {
    <otui-loading-state headline="Loading catalog"></otui-loading-state>
    }
  </learning-layout>`,
  styles: [
    `
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: 700 0.7rem ui-monospace, monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.6rem 0;
        font-size: clamp(2.7rem, 5vw, 5rem);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }
      .lede {
        max-width: 52ch;
        margin: 0 0 2rem;
        color: var(--lx-text-muted);
      }
      .courses {
        margin-top: 1.75rem;
        border-top: 1px solid var(--lx-border-soft);
      }
      .course {
        display: block;
        border-bottom: 1px solid var(--lx-border-soft);
        color: inherit;
        text-decoration: none;
      }
      .course:hover {
        background: var(--lx-surface-hover);
      }
      .empty {
        margin-top: 2rem;
        color: var(--lx-text-muted);
      }
    `,
  ],
})
export class CatalogComponent {
  private readonly router = inject(Router);
  private readonly data = inject(LearningDataService);
  readonly tracks = toSignal(this.data.catalog());
  private readonly serverSubjects = toSignal(this.data.subjects());

  readonly selectedSubject = signal('');

  private readonly rows = computed<CatalogRow[]>(() =>
    (this.tracks() ?? []).flatMap((track) =>
      track.offerings.map((offering) => this.toRow(track, offering))
    )
  );

  // Named and counted by the server, which is the only place that knows how
  // to name a subject nobody registered in advance.
  readonly subjects = computed<SubjectNavItem[]>(() =>
    (this.serverSubjects() ?? []).map((subject) => ({
      subjectId: subject.subjectId,
      displayName: subject.displayName,
      courseCount: subject.courseCount,
    }))
  );

  readonly visibleRows = computed(() => {
    const subject = this.selectedSubject();
    if (!subject) return this.rows();
    return this.rows().filter((row) => row.subjectIds.includes(subject));
  });

  readonly summary = computed(() => {
    const count = this.rows().length;
    const subjects = this.subjects().length;
    if (count === 0) return 'Nothing has been published here yet.';
    const courses = `${count} ${count === 1 ? 'course' : 'courses'}`;
    const across = `${subjects} ${subjects === 1 ? 'subject' : 'subjects'}`;
    return `${courses} across ${across}. Read any of them; enrol when you want to keep your progress.`;
  });

  readonly emptyMessage = computed(() =>
    this.selectedSubject()
      ? 'No courses in this subject yet.'
      : 'Nothing has been published here yet.'
  );

  private toRow(track: CatalogTrack, offering: CatalogOffering): CatalogRow {
    return {
      offeringId: offering.id,
      trackId: track.id,
      // A course is filed under its own subject, falling back to the track's,
      // so an offering that names one is not lost from the subject nav.
      subjectIds: offering.subjectId
        ? [offering.subjectId]
        : track.subjectIds ?? [],
      displayName: offering.displayName,
      description: offering.description ?? '',
      variantLabel: track.variantAxis?.options[0]?.displayName ?? '',
      isDraft: offering.status !== 'published',
      lessonCount: (offering.modules ?? []).reduce(
        (total, module) => total + module.lessons.length,
        0
      ),
      credits: offering.credits ?? 0,
      level: offering.level ?? 0,
    };
  }
}
