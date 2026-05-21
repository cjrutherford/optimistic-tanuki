import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AppBarComponent,
  NavSidebarComponent as LibraryNavSidebarComponent,
  type NavItem,
} from '@optimistic-tanuki/navigation-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-navigation-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    AppBarComponent,
    LibraryNavSidebarComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/navigation-ui"
      title="Navigation UI"
      description="Navigation components for app bars, sidebars, and navigation menus."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('app-bar') {
        <div class="preview-full">
          <otui-app-bar />
        </div>
        } @case ('nav-sidebar') {
        <div class="preview-side">
          <otui-nav-sidebar
            [isOpen]="true"
            [heading]="'Playground Navigation'"
            [navItems]="sampleNavItems"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-full {
        min-height: 60px;
        overflow: hidden;
      }

      .preview-side {
        min-height: 260px;
        max-width: 320px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationUiPageComponent {
  readonly importSnippet = `import { AppBarComponent, NavSidebarComponent } from '@optimistic-tanuki/navigation-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly sampleNavItems: NavItem[] = [
    { label: 'Overview', isActive: true },
    { label: 'Components' },
    { label: 'Tokens' },
    { label: 'Settings', variant: 'secondary' },
  ];

  readonly elements: PlaygroundElement[] = [
    {
      id: 'app-bar',
      title: 'App Bar',
      headline: 'Top navigation bar',
      importName: 'AppBarComponent',
      selector: 'otui-app-bar',
      summary: 'Top application bar with branding and actions.',
      props: [],
    },
    {
      id: 'nav-sidebar',
      title: 'Nav Sidebar',
      headline: 'Collapsible side navigation',
      importName: 'NavSidebarComponent',
      selector: 'otui-nav-sidebar',
      summary: 'Action-oriented sidebar for app sections and contextual navigation.',
      props: [],
    },
  ];

  constructor() {
    for (const el of this.elements) {
      this.configs[el.id] = {};
    }
  }

  resetConfig(id: string): void {
    this.configs[id] = {};
  }
}
