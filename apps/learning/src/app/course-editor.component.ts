import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import {
  ActivityEditorComponent,
  EditableActivity,
  LessonAddress,
  LessonEditorComponent,
  OutlineEditorComponent,
  OutlineModule,
} from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService, OfferingDetail } from './learning-data.service';
import { LessonMarkdownService } from './lesson-markdown.service';

/**
 * Writing a course.
 *
 * The editors themselves are in learning-ui; this holds the course being
 * edited, renders the preview with the same markdown pipeline a reader gets,
 * and saves. Everything is edited locally and written in one request, which
 * matches how the server stores a course: modules and activities are replaced
 * wholesale rather than patched piece by piece.
 */
@Component({
  selector: 'learning-course-editor',
  imports: [
    LearningLayoutComponent,
    LoadingStateComponent,
    OutlineEditorComponent,
    LessonEditorComponent,
    ActivityEditorComponent,
    RouterLink,
  ],
  template: `<learning-layout>
    @if (loaded()) {
    <a routerLink="/author" class="back">← Your courses</a>

    <header>
      <div class="header-line">
        <p class="eyebrow">
          {{ isPublished() ? 'Published' : 'Draft' }}
        </p>
        <span class="ownership">{{ isOwner() ? 'Owner' : 'Co-editor' }}</span>
      </div>
      <label class="name-field">
        <span class="sr-only">Course name</span>
        <input
          class="name"
          type="text"
          aria-label="Course name"
          [value]="displayName()"
          (input)="displayName.set(value($event))"
        />
      </label>
      <label class="description-field">
        <span>Description</span>
        <textarea
          class="description"
          rows="2"
          aria-label="Course description"
          placeholder="What is this course about?"
          [value]="description()"
          (input)="description.set(value($event))"
        ></textarea>
      </label>
    </header>

    <section class="metadata" aria-labelledby="metadata-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Course brief</p>
          <h2 id="metadata-title">Make the promise clear.</h2>
        </div>
        <p>These fields appear on the course page before a learner starts.</p>
      </div>
      <div class="metadata-grid">
        <label>
          <span>Who is this for?</span>
          <textarea
            class="audience"
            rows="3"
            placeholder="People who are ready to…"
            [value]="audience()"
            (input)="audience.set(value($event))"
          ></textarea>
        </label>
        <label>
          <span>What will they be able to do?</span>
          <textarea
            class="outcome"
            rows="3"
            placeholder="By the end, learners can…"
            [value]="outcome()"
            (input)="outcome.set(value($event))"
          ></textarea>
        </label>
      </div>
    </section>

    <div class="bar">
      <button
        type="button"
        class="primary"
        [disabled]="saving()"
        [attr.aria-busy]="saving()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
      @if (isOwner()) {
      <button
        type="button"
        class="secondary"
        [disabled]="saving()"
        [attr.aria-busy]="saving()"
        (click)="togglePublished()"
      >
        {{ isPublished() ? 'Unpublish' : 'Publish' }}
      </button>
      } @if (message()) {
      <span class="message" role="status">{{ message() }}</span>
      } @if (error()) {
      <span class="error" role="alert">{{ error() }}</span>
      }
    </div>

    <div class="workspace">
      <otlearn-outline-editor
        [modules]="modules()"
        [selected]="selected()"
        (outlineChange)="modules.set($event)"
        (selectLesson)="selected.set($event)"
      ></otlearn-outline-editor>

      @if (currentLesson(); as lesson) {
      <otlearn-lesson-editor
        [title]="lesson.title"
        [slug]="lesson.slug"
        [body]="lesson.body"
        [previewHtml]="preview()"
        (titleChange)="editLesson('title', $event)"
        (slugChange)="editLesson('slug', $event)"
        (bodyChange)="editLesson('body', $event)"
      ></otlearn-lesson-editor>
      } @else {
      <p class="pick">Pick a lesson from the outline to write it.</p>
      }
    </div>

    <otlearn-activity-editor
      [activities]="activities()"
      [lessons]="allLessons()"
      (activitiesChange)="activities.set($event)"
    ></otlearn-activity-editor>
    } @else {
    <otui-loading-state headline="Loading course"></otui-loading-state>
    }
  </learning-layout>`,
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1.25rem;
        color: var(--lx-text-muted);
        font-size: 0.85rem;
        text-decoration: none;
      }
      .back:focus-visible,
      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible {
        outline: var(--lx-border-width) var(--lx-border-style) var(--lx-focus);
        outline-offset: 3px;
      }
      .header-line {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.7rem var(--lx-font-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .ownership {
        padding: 0.18rem 0.45rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.65rem var(--lx-font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .name,
      .description {
        display: block;
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.5rem 0.6rem;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-radius: var(--lx-radius);
        background: transparent;
        color: var(--lx-text);
        font: inherit;
        transition: var(--lx-btn-transition);
      }
      .name {
        font-size: clamp(1.8rem, 3.5vw, 2.8rem);
        font-weight: 800;
        letter-spacing: -0.04em;
      }
      .description {
        color: var(--lx-text-muted);
        resize: vertical;
      }
      .description-field,
      .metadata label {
        display: grid;
        gap: 0.35rem;
      }
      .description-field > span,
      .metadata label > span {
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.68rem var(--lx-font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .name:hover,
      .description:hover,
      .name:focus,
      .description:focus {
        border-color: var(--lx-border-strong);
        background: var(--lx-surface);
      }
      .metadata {
        display: grid;
        gap: 1rem;
        margin-top: 1.5rem;
        padding: 1.2rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left-width: calc(var(--lx-border-width) + 3px);
        border-left-color: var(--lx-accent);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .section-heading {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: end;
      }
      .section-kicker {
        margin: 0 0 0.35rem;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.68rem var(--lx-font-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .section-heading h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.3rem, 2.5vw, 1.8rem);
        line-height: 1.05;
      }
      .section-heading > p {
        max-width: 34ch;
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 0.82rem;
        line-height: 1.5;
      }
      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }
      .metadata textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.55rem 0.6rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-text);
        font: inherit;
        resize: vertical;
        transition: var(--lx-btn-transition);
      }
      .metadata textarea:hover,
      .metadata textarea:focus {
        border-color: var(--lx-accent);
      }
      .bar {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        flex-wrap: wrap;
        margin: 1.5rem 0;
        padding: 0.9rem 0;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .bar button {
        min-height: 2.55rem;
        padding: 0.45rem 0.9rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        background: transparent;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.75rem var(--lx-font-mono);
        text-transform: var(--lx-btn-transform);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .bar button.primary {
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-sm);
      }
      .bar button:hover:not(:disabled) {
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      .bar button:active:not(:disabled) {
        box-shadow: var(--lx-shadow-inset);
        transform: translate(1px, 1px);
      }
      .bar button:disabled {
        opacity: 0.4;
        cursor: default;
        box-shadow: none;
      }
      .message {
        color: var(--lx-accent);
        font-size: 0.85rem;
      }
      .error {
        color: var(--lx-danger);
        font-size: 0.85rem;
      }
      .workspace {
        display: grid;
        grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
        gap: 2rem;
        align-items: start;
        margin-bottom: 2.5rem;
        padding-top: 0.5rem;
      }
      .pick {
        color: var(--lx-text-muted);
      }
      @media (max-width: 900px) {
        .section-heading {
          align-items: start;
          flex-direction: column;
        }
        .metadata-grid {
          grid-template-columns: 1fr;
        }
        .workspace {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CourseEditorComponent {
  private readonly data = inject(LearningDataService);
  private readonly markdown = inject(LessonMarkdownService);
  private readonly offeringId =
    inject(ActivatedRoute).snapshot.paramMap.get('offeringId') ?? '';

  readonly loaded = signal(false);
  readonly displayName = signal('');
  readonly description = signal('');
  readonly audience = signal('');
  readonly outcome = signal('');
  readonly modules = signal<OutlineModule[]>([]);
  readonly activities = signal<EditableActivity[]>([]);
  readonly selected = signal<LessonAddress | null>(null);
  readonly isPublished = signal(false);
  /**
   * Whether this viewer owns the course, and so may publish it.
   *
   * This was hardcoded true and never set, so a co-editor was shown a publish
   * button that the server always refused. The server was right; the button
   * was the lie.
   */
  readonly isOwner = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  /** Every lesson in the course, so activities can be attached to one. */
  readonly allLessons = computed(() =>
    this.modules().flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title || 'Untitled lesson',
      }))
    )
  );

  readonly currentLesson = computed(() => {
    const address = this.selected();
    if (!address) return null;
    return (
      this.modules()[address.moduleIndex]?.lessons[address.lessonIndex] ?? null
    );
  });

  /**
   * The preview, rendered by the reader's own pipeline.
   *
   * Bound as a plain string rather than trusted HTML, so Angular's sanitizer
   * runs over it exactly as it does on the lesson page. A writer previewing
   * their own words should not get a more permissive renderer than a reader.
   */
  readonly preview = computed(() => {
    const lesson = this.currentLesson();
    return lesson?.body ? this.markdown.render(lesson.body) : '';
  });

  constructor() {
    this.data.offering(this.offeringId).subscribe({
      next: (detail) => detail && this.load(detail),
      error: () => {
        this.error.set('Could not open that course.');
        this.loaded.set(true);
      },
    });
  }

  private load(detail: OfferingDetail): void {
    this.displayName.set(detail.offering.displayName);
    this.description.set(detail.offering.description ?? '');
    this.audience.set(detail.offering.audience ?? '');
    this.outcome.set(detail.offering.outcome ?? '');
    this.isPublished.set(detail.offering.status === 'published');
    this.isOwner.set(detail.isOwner ?? false);
    this.modules.set(
      (detail.offering.modules ?? []).map((module) => ({
        id: module.id,
        title: module.title,
        lessons: (module.lessons ?? []).map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          // Only a lesson written here has a body. One backed by a file in the
          // repository has none, and this editor is not the place to rewrite
          // the shipped courseware.
          body:
            (lesson as { content?: { body?: string }[] }).content?.[0]?.body ??
            '',
        })),
      }))
    );
    this.activities.set(
      ((detail.offering as { activities?: EditableActivity[] }).activities ??
        []) as EditableActivity[]
    );
    this.loaded.set(true);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected editLesson(field: 'title' | 'slug' | 'body', next: string): void {
    const address = this.selected();
    if (!address) return;
    this.modules.update((modules) =>
      modules.map((module, moduleIndex) =>
        moduleIndex !== address.moduleIndex
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson, lessonIndex) =>
                lessonIndex !== address.lessonIndex
                  ? lesson
                  : { ...lesson, [field]: next }
              ),
            }
      )
    );
  }

  save(): void {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.data
      .saveCourse(this.offeringId, {
        displayName: this.displayName().trim(),
        description: this.description().trim(),
        audience: this.audience().trim() || null,
        outcome: this.outcome().trim() || null,
        modules: this.toServerModules(),
        activities: this.activities(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Saved.');
        },
        error: (failure: { status?: number }) => {
          this.saving.set(false);
          // The server validates the whole course, so a rejected save usually
          // means something is half-written rather than that anything broke.
          this.error.set(
            failure?.status === 403
              ? 'This course is not yours to change.'
              : 'Not saved. Check that every lesson has words in it and every quiz has two options and an answer.'
          );
        },
      });
  }

  togglePublished(): void {
    const next = this.isPublished() ? 'draft' : 'published';
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.data.setCourseStatus(this.offeringId, next).subscribe({
      next: () => {
        this.isPublished.set(next === 'published');
        this.saving.set(false);
        this.message.set(
          next === 'published' ? 'Published.' : 'Taken back down.'
        );
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not change whether this is published.');
      },
    });
  }

  /** The outline in the shape the server stores. */
  private toServerModules() {
    return this.modules().map((module) => ({
      id: module.id,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        content: [{ format: 'markdown', body: lesson.body }],
      })),
    }));
  }
}
