import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgGridUiComponent, type ColDef } from '@optimistic-tanuki/ag-grid-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-ag-grid-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    AgGridUiComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/ag-grid-ui"
      title="AG Grid UI"
      description="Theme-aware enterprise data grid wrapper for dense, sortable application tables."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        <div class="preview-grid">
          <otui-ag-grid
            [rowData]="rowData"
            [columnDefs]="columnDefs"
            height="360px"
          />
        </div>
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-grid {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgGridUiPageComponent {
  readonly importSnippet = `import { AgGridUiComponent } from '@optimistic-tanuki/ag-grid-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly rowData = [
    {
      component: 'Button',
      status: 'stable',
      owner: 'common-ui',
      coverage: 92,
    },
    {
      component: 'Profile Selector',
      status: 'beta',
      owner: 'profile-ui',
      coverage: 74,
    },
    {
      component: 'Explore Page',
      status: 'alpha',
      owner: 'search-ui',
      coverage: 58,
    },
  ];
  readonly columnDefs: ColDef[] = [
    { field: 'component', headerName: 'Component' },
    { field: 'status', headerName: 'Status' },
    { field: 'owner', headerName: 'Library' },
    { field: 'coverage', headerName: 'Coverage %' },
  ];
  readonly elements: PlaygroundElement[] = [
    {
      id: 'ag-grid',
      title: 'AG Grid Wrapper',
      headline: 'Dense data table surface',
      importName: 'AgGridUiComponent',
      selector: 'otui-ag-grid',
      summary: 'Theme-aware AG Grid wrapper with sensible defaults for product dashboards.',
      props: [],
    },
  ];

  constructor() {
    this.configs['ag-grid'] = {};
  }
}
