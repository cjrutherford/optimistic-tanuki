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
import { RoleDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-ag-roles-table',
  standalone: true,
  imports: [CommonModule, AgGridUiComponent],
  template: `
    <div class="ag-roles-table-container">
      <div class="action-group">
        <button class="create-button" (click)="create.emit()">
          ➕ Create Role
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
      .ag-roles-table-container {
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
export class AgRolesTableComponent implements OnInit, OnChanges {
  @Input() roles: RoleDto[] = [];
  @Input() loading = false;
  @Input() height = '600px';

  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<RoleDto>();
  @Output() delete = new EventEmitter<RoleDto>();

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
      valueFormatter: (params: any) => params.value || 'N/A',
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
    this.rolesSignal.set(this.roles || []);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['roles']) {
      this.rolesSignal.set(this.roles || []);
    }
  }
}
