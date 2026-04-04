import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  PersonaSelectionMenuComponent,
  PersonaService,
} from '@optimistic-tanuki/persona-ui';
import type { PersonaTelosDto } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

class PlaygroundPersonaService {
  getAllPersonas() {
    return of<PersonaTelosDto[]>([
      {
        id: 'persona-1',
        name: 'Project Management Copilot',
        description: 'Helps organize tasks, milestones, and delivery decisions.',
        goals: ['Clarify scope', 'Sequence work', 'Reduce ambiguity'],
        skills: ['planning', 'prioritization', 'status summaries'],
        interests: ['delivery', 'roadmaps', 'coordination'],
        limitations: ['No production access'],
        strengths: ['Structured breakdowns', 'Next-step planning'],
        objectives: ['Keep work moving', 'Surface blockers early'],
        coreObjective: 'Turn ambiguous requests into executable plans.',
        exampleResponses: ['Here is the delivery sequence.', 'These are the blockers.'],
        promptTemplate: 'Act as a pragmatic project management copilot.',
      },
      {
        id: 'persona-2',
        name: 'Design System Editor',
        description: 'Refines token naming, previews, component docs, and interaction polish.',
        goals: ['Improve consistency', 'Raise visual quality', 'Tighten docs'],
        skills: ['design systems', 'component APIs', 'documentation'],
        interests: ['tokens', 'UI patterns', 'playgrounds'],
        limitations: ['No user research context'],
        strengths: ['Naming clarity', 'Surface-level API review'],
        objectives: ['Make design tools easier to use'],
        coreObjective: 'Improve consistency and clarity across UI building blocks.',
        exampleResponses: ['Rename these tokens.', 'These previews need stronger defaults.'],
        promptTemplate: 'Act as a design system editor focused on clarity.',
      },
    ]);
  }
}

@Component({
  selector: 'pg-persona-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    PersonaSelectionMenuComponent,
  ],
  providers: [{ provide: PersonaService, useClass: PlaygroundPersonaService }],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/persona-ui"
      title="Persona UI"
      description="Picker surface for selecting AI personas and assistant modes inside the product."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        <div class="preview-padded">
          <lib-persona-selection-menu />
        </div>
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
export class PersonaUiPageComponent {
  readonly importSnippet = `import { PersonaSelectionMenuComponent } from '@optimistic-tanuki/persona-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly elements: PlaygroundElement[] = [
    {
      id: 'persona-selection-menu',
      title: 'Persona Selection Menu',
      headline: 'Assistant selection surface',
      importName: 'PersonaSelectionMenuComponent',
      selector: 'lib-persona-selection-menu',
      summary: 'Menu for choosing between available AI helpers and assistant modes.',
      props: [],
    },
  ];

  constructor() {
    this.configs['persona-selection-menu'] = {};
  }
}
