import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageShellComponent, IndexChipComponent } from '../../shared';

@Component({
  selector: 'pg-hai-ui-page',
  standalone: true,
  imports: [CommonModule, PageShellComponent, IndexChipComponent],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/hai-ui"
      title="HAI UI"
      description="Human-AI Interaction components for intelligent assistant interfaces."
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
export class HaiUiPageComponent {
  readonly importSnippet = `import { HaiAboutModalComponent, HaiExpansionComponent, ... } from '@optimistic-tanuki/hai-ui';`;
  readonly components = [
    {
      id: 'hai-about-modal',
      name: 'HaiAboutModalComponent',
      selector: 'otui-hai-about-modal',
      description:
        'Modal for displaying AI assistant information and capabilities.',
    },
    {
      id: 'hai-about-tag',
      name: 'HaiAboutTagComponent',
      selector: 'otui-hai-about-tag',
      description: 'Tag component for AI-assisted features and capabilities.',
    },
    {
      id: 'hai-expansion',
      name: 'HaiExpansionComponent',
      selector: 'otui-hai-expansion',
      description: 'Expandable panels for AI interaction details and context.',
    },
  ];
}
