import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ExplorePageComponent,
  GlobalSearchComponent,
  SearchService,
  type SearchResponse,
  type SearchResult,
} from '@optimistic-tanuki/search-ui';
import { Observable, of } from 'rxjs';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

class PlaygroundSearchService {
  private readonly users: SearchResult[] = [
    {
      id: 'user-1',
      type: 'user',
      title: 'Ari Stone',
      subtitle: 'Developer Experience Lead',
      imageUrl: 'https://placehold.co/96x96/0f172a/e2e8f0?text=AS',
    },
  ];
  private readonly communities: SearchResult[] = [
    {
      id: 'community-1',
      type: 'community',
      title: 'Design Systems Guild',
      subtitle: 'Patterns, tokens, and tooling',
      imageUrl: 'https://placehold.co/400x120/1e293b/e2e8f0?text=Guild',
    },
  ];
  private readonly posts: SearchResult[] = [
    {
      id: 'post-1',
      type: 'post',
      title: 'Curated Explorer Roadmap',
      highlight:
        'Sequence compact workflow libraries before heavier domain surfaces',
    },
  ];

  search(query: string): Observable<SearchResponse> {
    const lower = query.toLowerCase();
    return of({
      users: this.users.filter((item) =>
        item.title.toLowerCase().includes(lower)
      ),
      communities: this.communities.filter((item) =>
        item.title.toLowerCase().includes(lower)
      ),
      posts: this.posts.filter((item) =>
        item.title.toLowerCase().includes(lower)
      ),
      total: 3,
    });
  }

  getTrending(): Observable<SearchResult[]> {
    return of(this.posts);
  }

  getSuggestedUsers(): Observable<SearchResult[]> {
    return of(this.users);
  }

  getSuggestedCommunities(): Observable<SearchResult[]> {
    return of(this.communities);
  }
}

@Component({
  selector: 'pg-search-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    GlobalSearchComponent,
    ExplorePageComponent,
  ],
  providers: [{ provide: SearchService, useClass: PlaygroundSearchService }],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/search-ui"
      title="Search UI"
      description="Search and discovery surfaces for quick lookup and broader exploration flows."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('global-search') {
        <div class="preview-padded">
          <search-global-search />
        </div>
        } @case ('explore-page') {
        <div class="preview-padded">
          <search-explore-page />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchUiPageComponent {
  readonly importSnippet = `import { GlobalSearchComponent, ExplorePageComponent } from '@optimistic-tanuki/search-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly elements: PlaygroundElement[] = [
    {
      id: 'global-search',
      title: 'Global Search',
      headline: 'Header search interaction',
      importName: 'GlobalSearchComponent',
      selector: 'search-global-search',
      summary: 'Compact query bar with inline result grouping and loading affordances.',
      props: [],
    },
    {
      id: 'explore-page',
      title: 'Explore Page',
      headline: 'Discovery browse surface',
      importName: 'ExplorePageComponent',
      selector: 'search-explore-page',
      summary: 'Tabbed exploration view for trending posts, suggested users, and communities.',
      props: [],
    },
  ];

  constructor() {
    for (const element of this.elements) {
      this.configs[element.id] = {};
    }
  }
}
