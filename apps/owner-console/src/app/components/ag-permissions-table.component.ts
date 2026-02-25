import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-ag-permissions-table',
  standalone: true,
  imports: [CommonModule, AgGridUiComponent],
  template: `
    <div class="ag-permissions-table-container">
      <div class="action-group">
        <button class="create-button" (click)="create.emit()">
          ➕ Create Permission
        </button>
      </div>
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
      .ag-permissions-table-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
        height: 100%;
        padding: 16px;
      }

      .action-group {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .create-button {
        padding: 8px 16px;
        background: var(--accent, #3f51b5);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .create-button:hover {
        background: var(--accent-darken-10, #303f9f);
      }
    `,
  ],
})
export class AgPermissionsTableComponent implements OnInit, OnChanges {
  @Input() permissions: PermissionDto[] = [];
  @Input() loading = false;
  @Input() height = '600px';
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<PermissionDto>();
  @Output() delete = new EventEmitter<PermissionDto>();

  // Internal signals
  private permissionsSignal = signal<PermissionDto[]>([]);
  gridData = computed(() => this.permissionsSignal());

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
      flex: 2,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'resource',
      headerName: 'Resource',
      flex: 1,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'action',
      headerName: 'Action',
      flex: 1,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'appScope.name',
      headerName: 'App Scope',
      flex: 1,
      filter: 'agTextColumnFilter',
      valueFormatter: (params) => params.value || 'None',
    },
    {
      field: 'targetId',
      headerName: 'Target ID',
      flex: 1,
      filter: 'agTextColumnFilter',
      valueFormatter: (params) => params.value || 'Global',
    },
    {
      headerName: 'Actions',
      cellRenderer: (params: any) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '✏️ Edit';
        editBtn.className = 'ag-grid-action-button';
        editBtn.addEventListener('click', () => {
          this.edit.emit(params.data);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️ Delete';
        deleteBtn.className = 'ag-grid-action-button ag-grid-delete-button';
        deleteBtn.addEventListener('click', () => {
          this.delete.emit(params.data);
        });

        container.appendChild(editBtn);
        container.appendChild(deleteBtn);
        return container;
      },
      width: 180,
      sortable: false,
      filter: false,
    },
  ];

  ngOnInit() {
    this.permissionsSignal.set(this.permissions || []);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['permissions']) {
      this.permissionsSignal.set(this.permissions || []);
    }
  }
}
