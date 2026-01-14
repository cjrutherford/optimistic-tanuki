import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-ag-roles-table',
  standalone: true,
  imports: [CommonModule, AgGridUiComponent],
  template: `
    <div class="ag-roles-table-container">
      <otui-ag-grid
        [rowData]="gridData()"
        [columnDefs]="columnDefs"
        [loading]="loading"
        [height]="height"
      />
    </div>
  `,
  styles: [
    `
      .ag-roles-table-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
        height: 100%;
        padding: 16px;
      }
    `,
  ],
})
export class AgRolesTableComponent implements OnInit, OnChanges {
  @Input() roles: RoleDto[] = [];
  @Input() loading: boolean = false;
  @Input() height: string = '600px';

  // Internal signals
  private rolesSignal = signal<RoleDto[]>([]);
  gridData = computed(() => this.rolesSignal());

  columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 3,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'appScope.name',
      headerName: 'App Scope',
      flex: 2,
      filter: 'agTextColumnFilter',
      valueFormatter: (params) => params.value || 'N/A',
    },
  ];

  ngOnInit() {
    this.rolesSignal.set(this.roles || []);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['roles']) {
      this.rolesSignal.set(this.roles || []);
    }
  }
}
