import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageShellComponent, IndexChipComponent } from '../../shared';

@Component({
  selector: 'pg-forum-ui-page',
  standalone: true,
  imports: [CommonModule, PageShellComponent, IndexChipComponent],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/forum-ui"
      title="Forum UI"
      description="Forum and discussion board components for community conversations."
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
        margin: 0;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.6;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForumUiPageComponent {
  readonly importSnippet = `import { ForumThreadComponent, ForumPostComponent, ... } from '@optimistic-tanuki/forum-ui';`;
  readonly components = [
    {
      id: 'forum-thread',
      name: 'ForumThreadComponent',
      selector: 'otui-forum-thread',
      description:
        'Thread container for forum discussions with reply hierarchy.',
    },
    {
      id: 'forum-post',
      name: 'ForumPostComponent',
      selector: 'otui-forum-post',
      description:
        'Individual post in a forum thread with formatting and actions.',
    },
  ];
}
