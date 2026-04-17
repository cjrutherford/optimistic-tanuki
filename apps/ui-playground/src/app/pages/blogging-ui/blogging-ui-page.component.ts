import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageShellComponent, IndexChipComponent } from '../../shared';

interface ComponentDoc {
  id: string;
  name: string;
  selector: string;
  description: string;
}

@Component({
  selector: 'pg-blogging-ui-page',
  standalone: true,
  imports: [CommonModule, PageShellComponent, IndexChipComponent],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/blogging-ui"
      title="Blogging UI"
      description="Blog and content management components for creating rich editorial experiences."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (comp of components; track comp.id) {
        <pg-index-chip [id]="comp.id" [label]="comp.name" />
        }
      </ng-container>

      @for (comp of components; track comp.id) {
      <div class="component-section" [id]="comp.id">
        <div class="section-header">
          <h3>{{ comp.name }}</h3>
          <code class="selector">{{ comp.selector }}</code>
        </div>
        <p class="description">{{ comp.description }}</p>
        <div class="code-preview">
          <pre><code>import {{ comp.name }} from '@optimistic-tanuki/blogging-ui';</code></pre>
        </div>
      </div>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .component-section {
        padding: 1.25rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1rem;
        background: rgba(8, 13, 22, 0.48);
        margin-bottom: 1rem;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }

      .section-header h3 {
        margin: 0;
        font-family: var(--font-heading);
        font-size: 1.15rem;
        color: var(--foreground);
      }

      .selector {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.35rem;
        background: rgba(59, 130, 246, 0.15);
        color: var(--primary);
      }

      .description {
        margin: 0 0 1rem;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.6;
      }

      .code-preview {
        padding: 0.85rem;
        border-radius: 0.75rem;
        background: rgba(5, 10, 18, 0.84);
      }

      .code-preview pre {
        margin: 0;
        color: #d9ebff;
        font-size: 0.8rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloggingUiPageComponent {
  readonly importSnippet = `import { BlogPostCardComponent, AuthorProfileComponent, ... } from '@optimistic-tanuki/blogging-ui';`;

  readonly components: ComponentDoc[] = [
    {
      id: 'blog-post-card',
      name: 'BlogPostCardComponent',
      selector: 'otui-blog-post-card',
      description:
        'Card component for displaying blog posts with featured image, title, excerpt, and metadata.',
    },
    {
      id: 'author-profile',
      name: 'AuthorProfileComponent',
      selector: 'otui-author-profile',
      description:
        'Author avatar, name, bio, and social links for post attribution.',
    },
    {
      id: 'blog-compose',
      name: 'BlogComposeComponent',
      selector: 'otui-blog-compose',
      description:
        'Rich text editor for creating and editing blog posts with media embedding.',
    },
    {
      id: 'comment-section',
      name: 'CommentSectionComponent',
      selector: 'otui-comment-section',
      description:
        'Threaded comments with replies, voting, and moderation controls.',
    },
    {
      id: 'featured-posts',
      name: 'FeaturedPostsComponent',
      selector: 'otui-featured-posts',
      description:
        'Hero section for highlighting featured or pinned blog posts.',
    },
    {
      id: 'contact-form',
      name: 'ContactFormComponent',
      selector: 'otui-contact-form',
      description: 'Contact form with validation for reader inquiries.',
    },
    {
      id: 'context-menu',
      name: 'ContextMenuComponent',
      selector: 'otui-context-menu',
      description:
        'Right-click context menu for post actions like share, edit, delete.',
    },
  ];
}
