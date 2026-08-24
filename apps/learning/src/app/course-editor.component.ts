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
      <p class="eyebrow">
        {{ isPublished() ? 'Published' : 'Draft' }}
      </p>
      <input
        class="name"
        type="text"
        aria-label="Course name"
        [value]="displayName()"
        (input)="displayName.set(value($event))"
      />
      <textarea
        class="description"
        rows="2"
        aria-label="Course description"
        placeholder="What is this course about?"
        [value]="description()"
        (input)="description.set(value($event))"
      ></textarea>
    </header>

    <div class="bar">
      <button type="button" [disabled]="saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
      @if (isOwner()) {
      <button type="button" [disabled]="saving()" (click)="togglePublished()">
        {{ isPublished() ? 'Unpublish' : 'Publish' }}
      </button>
      } @if (message()) {
      <span class="message" role="status">{{ message() }}</span>
      } @if (error()) {
      <span class="error" role="status">{{ error() }}</span>
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
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .name,
      .description {
        display: block;
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.4rem 0.5rem;
        border: 1px solid transparent;
        border-radius: var(--lx-radius, 2px);
        background: transparent;
        color: inherit;
        font: inherit;
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
      .name:hover,
      .description:hover,
      .name:focus,
      .description:focus {
        border-color: var(--lx-border-soft);
      }
      .bar {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        flex-wrap: wrap;
        margin: 1.5rem 0;
        padding: 0.9rem 0;
        border-top: 1px solid var(--lx-border-soft);
        border-bottom: 1px solid var(--lx-border-soft);
      }
      .bar button {
        padding: 0.45rem 0.9rem;
        border: 1px solid var(--lx-accent);
        border-radius: var(--lx-radius, 2px);
        background: transparent;
        color: var(--lx-accent);
        font: inherit;
        cursor: pointer;
      }
      .bar button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .message {
        color: var(--lx-text-muted);
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
      }
      .pick {
        color: var(--lx-text-muted);
      }
      @media (max-width: 900px) {
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
  readonly modules = signal<OutlineModule[]>([]);
  readonly activities = signal<EditableActivity[]>([]);
  readonly selected = signal<LessonAddress | null>(null);
  readonly isPublished = signal(false);
  readonly isOwner = signal(true);
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
    this.isPublished.set(detail.offering.status === 'published');
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
