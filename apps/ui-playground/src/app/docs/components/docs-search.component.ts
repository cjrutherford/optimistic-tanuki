import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocsSearchDocument } from '../models/docs.models';
import { toDocRouteSegments } from '../utils/docs-slug';

@Component({
  selector: 'pg-docs-search',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="docs-search">
      <label class="search-shell">
        <span class="search-label">Search</span>
        <input
          type="search"
          [value]="query"
          (input)="setQuery($any($event.target).value)"
          placeholder="Search docs, headings, and tags"
          name="docs-search"
          autocomplete="off"
          enterkeyhint="search"
          spellcheck="false"
        />
      </label>

      <div class="search-results" *ngIf="query">
        <ng-container *ngIf="filteredDocuments.length; else emptyState">
          <a
            *ngFor="let document of filteredDocuments; trackBy: trackBySlug"
            class="search-result"
            [routerLink]="toDocRouteSegments(document.slug)"
          >
            <span class="result-title">{{ document.title }}</span>
            <span class="result-meta">{{ document.category }}</span>
            <p>{{ document.summary }}</p>
          </a>
        </ng-container>
        <ng-template #emptyState>
          <p class="empty-state">No documents match this search yet.</p>
        </ng-template>
      </div>
    </section>
  `,
  styles: [
    `
      .docs-search {
        display: grid;
        gap: 0.9rem;
      }

      .search-shell {
        display: grid;
        gap: 0.45rem;
      }

      .search-label {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      input {
        min-height: 3rem;
        padding: 0 0.95rem;
        border: 1px solid rgba(129, 168, 222, 0.14);
        border-radius: 1rem;
        background: rgba(9, 15, 24, 0.82);
        color: var(--foreground);
      }

      .search-results {
        display: grid;
        gap: 0.65rem;
      }

      .search-result {
        display: grid;
        gap: 0.25rem;
        padding: 0.9rem 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1rem;
        background: rgba(8, 13, 22, 0.56);
        color: inherit;
        text-decoration: none;
        transition: border-color 160ms ease, transform 160ms ease,
          background-color 160ms ease;
      }

      .search-result:hover {
        transform: translateY(-1px);
        border-color: rgba(129, 168, 222, 0.24);
      }

      .result-title {
        font-weight: 600;
      }

      .result-meta {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.7rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .search-result p,
      .empty-state {
        margin: 0;
        color: var(--muted);
      }
    `,
  ],
})
export class DocsSearchComponent {
  @Input() documents: DocsSearchDocument[] = [];

  query = '';

  setQuery(query: string): void {
    this.query = query;
  }

  trackBySlug(_index: number, document: DocsSearchDocument): string {
    return document.slug;
  }

  protected readonly toDocRouteSegments = toDocRouteSegments;

  get filteredDocuments(): DocsSearchDocument[] {
    const normalizedQuery = this.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return this.documents.filter((document) => {
      const haystack = [
        document.title,
        document.summary,
        document.category,
        ...document.tags,
        ...document.headings.map((heading) => heading.text),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }
}
