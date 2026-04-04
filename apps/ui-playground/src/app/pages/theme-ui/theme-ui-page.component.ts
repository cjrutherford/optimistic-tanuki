import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  PersonalitySelectorComponent,
  PersonalityPreviewComponent,
  ThemeDemoComponent,
} from '@optimistic-tanuki/theme-ui';
import {
  PageShellComponent,
  ElementCardComponent,
  IndexChipComponent,
  PlaygroundElement,
  ElementConfig,
} from '../../shared';

@Component({
  selector: 'pg-theme-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    PersonalitySelectorComponent,
    PersonalityPreviewComponent,
    ThemeDemoComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/theme-ui"
      title="Theme UI"
      description="Theming components for personality selection, palette management, and design token visualization."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card
        [element]="el"
        [config]="configs[el.id]"
        (configChange)="configs[el.id] = $event"
        (reset)="resetConfig(el.id)"
      >
        @switch (el.id) { @case ('personality-selector') {
        <div class="preview-padded">
          <lib-personality-selector />
        </div>
        } @case ('personality-preview') {
        <div class="preview-padded">
          <lib-personality-preview />
        </div>
        } @case ('theme-demo') {
        <div class="preview-padded">
          <theme-demo />
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
        min-height: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeUiPageComponent {
  readonly importSnippet = `import { PersonalitySelectorComponent, PersonalityPreviewComponent, ... } from '@optimistic-tanuki/theme-ui';`;

  configs: Record<string, ElementConfig> = {};

  readonly elements: PlaygroundElement[] = [
    {
      id: 'personality-selector',
      title: 'Personality Selector',
      headline: 'Theme personality picker',
      importName: 'PersonalitySelectorComponent',
      selector: 'otui-personality-selector',
      summary: 'Dropdown or card-based selector for theme personalities.',
      props: [],
    },
    {
      id: 'personality-preview',
      title: 'Personality Preview',
      headline: 'Visual personality preview',
      importName: 'PersonalityPreviewComponent',
      selector: 'otui-personality-preview',
      summary: 'Visual preview of the current theme personality.',
      props: [],
    },
    {
      id: 'theme-demo',
      title: 'Theme Demo',
      headline: 'Live theme demonstration',
      importName: 'ThemeDemoComponent',
      selector: 'otui-theme-demo',
      summary: 'Interactive demo of theme capabilities.',
      props: [],
    },
  ];

  constructor() {
    this.initConfigs();
  }

  private initConfigs(): void {
    for (const el of this.elements) {
      this.configs[el.id] = {};
    }
  }

  resetConfig(id: string): void {
    this.configs[id] = {};
  }
}
