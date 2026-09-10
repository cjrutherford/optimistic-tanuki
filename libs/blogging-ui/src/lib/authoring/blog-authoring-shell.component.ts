import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BlogAuthoringCatalog,
  BlogAuthoringDataService,
  BlogAuthoringPost,
  BlogAuthoringWorkspace,
} from '@optimistic-tanuki/blogging-data-access';

export type BlogAuthoringState = 'loading' | 'denied' | 'empty' | 'ready';

@Component({
  selector: 'ot-blog-authoring-shell',
  standalone: true,
  template: `
    <section class="authoring-shell" aria-labelledby="blog-authoring-title">
      <p class="eyebrow">Workspace authoring</p>
      <h2 id="blog-authoring-title">Blog publishing</h2>
      <p class="context">Workspace: {{ workspaceId }}</p>
      @if (state === 'loading' || loading) {
      <p role="status">Loading publishing authoring…</p>
      } @else if (state === 'denied') {
      <p data-authoring-denied role="alert">
        Blog authoring is not available for this workspace.
      </p>
      } @else {
      <div data-blog-authoring-ready>
        <div class="catalog-controls">
          <label for="blog-catalog">Catalog</label>
          @if (catalogs.length) {
          <select
            id="blog-catalog"
            [value]="selectedCatalogId"
            (change)="selectCatalog($any($event.target).value)"
          >
            @for (catalog of catalogs; track catalog.id) {
            <option [value]="catalog.id">{{ catalog.name }}</option>
            }
          </select>
          } @else {
          <p data-authoring-empty>No catalog exists for this workspace yet.</p>
          }
          <form (submit)="createCatalog($event)">
            <label for="new-blog-catalog">New catalog name</label>
            <input
              id="new-blog-catalog"
              [value]="catalogName"
              (input)="catalogName = $any($event.target).value"
              required
            />
            <input
              aria-label="Catalog description"
              [value]="catalogDescription"
              (input)="catalogDescription = $any($event.target).value"
              placeholder="Description (optional)"
            />
            <button type="submit" data-create-catalog>Create catalog</button>
          </form>
        </div>

        @if (selectedCatalogId) {
        <div class="post-list">
          <h3>Posts</h3>
          @if (!posts.length) {
          <p>No posts in this catalog yet.</p>
          } @else { @for (post of posts; track post.id) {
          <article class="post-row">
            <strong>{{ post.title }}</strong>
            <span>{{ post.isDraft ? 'Draft' : 'Published' }}</span>
            @if (post.isDraft) {
            <button
              type="button"
              [attr.data-publish-post]="post.id"
              (click)="publishPost(post)"
            >
              Publish
            </button>
            }
          </article>
          } }
        </div>

        <form class="post-form" (submit)="createPost($event)">
          <h3>Create a draft</h3>
          <label for="blog-author-id">Author ID</label>
          <input
            id="blog-author-id"
            [value]="authorId"
            (input)="authorId = $any($event.target).value"
            required
          />
          <label for="blog-post-title">Title</label>
          <input
            id="blog-post-title"
            [value]="postTitle"
            (input)="postTitle = $any($event.target).value"
            required
          />
          <label for="blog-post-content">Content</label>
          <textarea
            id="blog-post-content"
            [value]="postContent"
            (input)="postContent = $any($event.target).value"
            required
          ></textarea>
          <button type="submit" data-create-post>Create draft</button>
        </form>
        }
      </div>
      } @if (errorMessage) {
      <p role="alert" data-authoring-error>{{ errorMessage }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .authoring-shell {
        padding: 1.25rem;
        border: 1px solid var(--border, #d7dce5);
        border-radius: 1rem;
        background: var(--surface, #fff);
      }
      .eyebrow {
        margin: 0;
        color: var(--primary, #315fdd);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .context {
        color: var(--muted, #64748b);
      }
      .catalog-controls,
      .post-form {
        display: grid;
        gap: 0.5rem;
        margin-top: 1rem;
        max-width: 34rem;
      }
      .post-list {
        display: grid;
        gap: 0.5rem;
        margin-top: 1.5rem;
      }
      .post-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--border, #d7dce5);
        border-radius: 0.5rem;
      }
      .post-row span {
        color: var(--muted, #64748b);
      }
      button {
        width: fit-content;
        padding: 0.55rem 0.8rem;
        border: 0;
        border-radius: 0.5rem;
        background: var(--primary, #315fdd);
        color: #fff;
        font-weight: 700;
      }
      input,
      select,
      textarea {
        max-width: 34rem;
        padding: 0.55rem;
        border: 1px solid var(--border, #d7dce5);
        border-radius: 0.4rem;
        font: inherit;
      }
      textarea {
        min-height: 8rem;
      }
    `,
  ],
})
export class BlogAuthoringShellComponent implements OnChanges {
  private readonly dataAccess = inject(BlogAuthoringDataService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) workspaceId = '';
  @Input({ required: true }) workspaceSlug = '';
  @Input({ required: true }) appScope = '';
  @Input() state: BlogAuthoringState = 'loading';
  @Output() readonly createRequested = new EventEmitter<void>();

  catalogs: BlogAuthoringCatalog[] = [];
  posts: BlogAuthoringPost[] = [];
  selectedCatalogId = '';
  catalogName = '';
  catalogDescription = '';
  authorId = '';
  postTitle = '';
  postContent = '';
  loading = false;
  errorMessage = '';
  private loadedWorkspaceKey = '';
  private contextGeneration = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['workspaceId'] ||
      changes['workspaceSlug'] ||
      changes['appScope']
    ) {
      this.contextGeneration += 1;
    }
    if (
      this.state === 'ready' &&
      this.workspaceId &&
      (changes['state'] ||
        changes['workspaceId'] ||
        changes['workspaceSlug'] ||
        changes['appScope'])
    ) {
      this.loadWorkspace();
    }
  }

  selectCatalog(catalogId: string): void {
    this.selectedCatalogId = catalogId;
    this.posts = [];
    this.errorMessage = '';
    const generation = this.contextGeneration;
    this.dataAccess
      .listPosts(this.workspaceContext(), catalogId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          if (
            generation === this.contextGeneration &&
            this.selectedCatalogId === catalogId
          ) {
            this.posts = posts;
          }
        },
        error: (error: Error) => {
          if (
            generation === this.contextGeneration &&
            this.selectedCatalogId === catalogId
          ) {
            this.showError(error);
          }
        },
      });
  }

  createCatalog(event: Event): void {
    event.preventDefault();
    if (!this.catalogName.trim()) return;
    const generation = this.contextGeneration;
    this.dataAccess
      .createCatalog(
        this.workspaceContext(),
        this.catalogName.trim(),
        this.catalogDescription.trim() || undefined
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalog) => {
          if (generation !== this.contextGeneration) return;
          this.catalogs = [...this.catalogs, catalog];
          this.catalogName = '';
          this.catalogDescription = '';
          this.selectCatalog(catalog.id);
        },
        error: (error: Error) => {
          if (generation === this.contextGeneration) this.showError(error);
        },
      });
  }

  createPost(event: Event): void {
    event.preventDefault();
    if (
      !this.authorId.trim() ||
      !this.postTitle.trim() ||
      !this.postContent.trim()
    )
      return;
    const generation = this.contextGeneration;
    this.dataAccess
      .createPost(this.workspaceContext(), {
        title: this.postTitle.trim(),
        content: this.postContent.trim(),
        authorId: this.authorId.trim(),
        selectedCatalogId: this.selectedCatalogId,
        isDraft: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          if (generation !== this.contextGeneration) return;
          this.posts = [post, ...this.posts];
          this.postTitle = '';
          this.postContent = '';
          this.createRequested.emit();
        },
        error: (error: Error) => {
          if (generation === this.contextGeneration) this.showError(error);
        },
      });
  }

  publishPost(post: BlogAuthoringPost): void {
    const generation = this.contextGeneration;
    this.dataAccess
      .publishPost(this.workspaceContext(), post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (published) => {
          if (generation !== this.contextGeneration) return;
          this.posts = this.posts.map((current) =>
            current.id === published.id ? published : current
          );
        },
        error: (error: Error) => {
          if (generation === this.contextGeneration) this.showError(error);
        },
      });
  }

  private loadWorkspace(): void {
    const workspaceKey = `${this.workspaceId}:${this.workspaceSlug}:${this.appScope}`;
    if (workspaceKey === this.loadedWorkspaceKey) return;
    this.loadedWorkspaceKey = workspaceKey;
    const generation = this.contextGeneration;
    this.loading = true;
    this.errorMessage = '';
    this.dataAccess
      .listCatalogs(this.workspaceContext())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogs) => {
          if (generation !== this.contextGeneration) return;
          this.catalogs = catalogs;
          this.loading = false;
          if (catalogs[0]) this.selectCatalog(catalogs[0].id);
        },
        error: (error: Error) => {
          if (generation !== this.contextGeneration) return;
          this.loading = false;
          this.showError(error);
        },
      });
  }

  private showError(error: Error): void {
    this.errorMessage = error?.message || 'Blog authoring could not be loaded.';
  }

  private workspaceContext(): BlogAuthoringWorkspace {
    return {
      workspaceId: this.workspaceId,
      workspaceSlug: this.workspaceSlug,
      appScope: this.appScope,
    };
  }
}
