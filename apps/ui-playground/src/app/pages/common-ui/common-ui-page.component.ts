import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  CardComponent,
  SpinnerComponent,
  BadgeComponent,
  GlassContainerComponent,
} from '@optimistic-tanuki/common-ui';
import {
  PageShellComponent,
  ElementCardComponent,
  IndexChipComponent,
  PlaygroundElement,
  ElementConfig,
} from '../../shared';

@Component({
  selector: 'pg-common-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    ButtonComponent,
    CardComponent,
    SpinnerComponent,
    BadgeComponent,
    GlassContainerComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/common-ui"
      title="Common UI"
      description="Core UI primitives for building consistent interfaces: buttons, cards, modals, and layout components."
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
        @switch (el.id) { @case ('button') {
        <div class="preview-centered">
          <otui-button
            [variant]="$any(configs['button']['variant'])"
            [disabled]="$any(configs['button']['disabled'])"
          >
            Click Me
          </otui-button>
        </div>
        } @case ('card') {
        <div class="preview-padded">
          <otui-card>
            <h3>Card Title</h3>
            <p>Card content goes here with some sample text.</p>
          </otui-card>
        </div>
        } @case ('spinner') {
        <div class="preview-centered">
          <otui-spinner />
        </div>
        } @case ('badge') {
        <div class="preview-centered">
          <otui-badge
            [variant]="$any(configs['badge']['variant'])"
            [size]="$any(configs['badge']['size'])"
          >
            Badge
          </otui-badge>
        </div>
        } @case ('glass-container') {
        <otui-glass-container>
          <p style="padding: 1.5rem; margin: 0;">Glassmorphic container content</p>
        </otui-glass-container>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-centered {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        padding: 2rem;
      }

      .preview-padded {
        padding: 1.5rem;
        min-height: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommonUiPageComponent {
  readonly importSnippet = `import { ButtonComponent, CardComponent, SpinnerComponent, BadgeComponent, ... } from '@optimistic-tanuki/common-ui';`;

  configs: Record<string, ElementConfig> = {};

  readonly elements: PlaygroundElement[] = [
    {
      id: 'button',
      title: 'Button',
      headline: 'Primary interaction element',
      importName: 'ButtonComponent',
      selector: 'otui-button',
      summary: 'Versatile button component with variants, sizes, and states.',
      props: [
        { name: 'variant', type: 'string', defaultValue: "'primary'", description: 'Visual style variant.', options: ['primary', 'secondary', 'outline', 'ghost', 'danger'] },
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the button.' },
      ],
    },
    {
      id: 'card',
      title: 'Card',
      headline: 'Content container',
      importName: 'CardComponent',
      selector: 'otui-card',
      summary: 'Flexible card component for grouping related content.',
      props: [],
    },
    {
      id: 'spinner',
      title: 'Spinner',
      headline: 'Loading indicator',
      importName: 'SpinnerComponent',
      selector: 'otui-spinner',
      summary: 'Animated loading spinner for async operations.',
      props: [],
    },
    {
      id: 'badge',
      title: 'Badge',
      headline: 'Status and count indicator',
      importName: 'BadgeComponent',
      selector: 'otui-badge',
      summary: 'Small badge for status, counts, or labels.',
      props: [
        { name: 'variant', type: 'string', defaultValue: "'default'", description: 'Badge color variant.', options: ['default', 'primary', 'success', 'warning', 'danger'] },
        { name: 'size', type: 'string', defaultValue: "'medium'", description: 'Badge size.', options: ['small', 'medium', 'large'] },
      ],
    },
    {
      id: 'glass-container',
      title: 'Glass Container',
      headline: 'Glassmorphic container',
      importName: 'GlassContainerComponent',
      selector: 'otui-glass-container',
      summary: 'Frosted glass effect container for modern UI.',
      props: [],
    },
  ];

  constructor() {
    this.initConfigs();
  }

  private initConfigs(): void {
    for (const el of this.elements) {
      const cfg: ElementConfig = {};
      for (const prop of el.props) {
        cfg[prop.name] = this.parseDefault(prop);
      }
      this.configs[el.id] = cfg;
    }
  }

  private parseDefault(prop: { type: string; defaultValue: string }): number | string | boolean {
    const v = prop.defaultValue;
    if (prop.type === 'boolean') return v === 'true';
    if (prop.type === 'number') return parseFloat(v) || 0;
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }

  resetConfig(id: string): void {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    const cfg: ElementConfig = {};
    for (const prop of el.props) {
      cfg[prop.name] = this.parseDefault(prop);
    }
    this.configs[id] = cfg;
  }
}
