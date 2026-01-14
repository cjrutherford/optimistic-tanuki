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
import { AppScopeDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-ag-app-scopes-table',
  standalone: true,
  imports: [CommonModule, AgGridUiComponent],
  template: `
    <div class="ag-app-scopes-table-container">
      <div class="action-group">
        <button class="create-button" (click)="create.emit()">
          ➕ Create App Scope
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
      .ag-app-scopes-table-container {
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
export class AgAppScopesTableComponent implements OnInit, OnChanges {
  @Input() appScopes: AppScopeDto[] = [];
  @Input() permissionCounts: Map<string, number> = new Map();
  @Input() loading: boolean = false;
  @Input() height: string = '600px';
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<AppScopeDto>();
  @Output() delete = new EventEmitter<AppScopeDto>();

  // Internal signals
  private appScopesSignal = signal<AppScopeDto[]>([]);
  gridData = computed(() => this.appScopesSignal());

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
      field: 'active',
      headerName: 'Status',
      flex: 1,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: any) => {
        const active = params.value;
        const badge = document.createElement('span');
        badge.textContent = active ? 'Active' : 'Inactive';
        badge.style.padding = '4px 12px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = '600';
        badge.style.backgroundColor = active ? '#4caf50' : '#ff9800';
        badge.style.color = 'white';
        return badge;
      },
    },
    {
      headerName: 'Permissions',
      valueGetter: (params: any) => {
        const count = this.permissionCounts.get(params.data.id) || 0;
        return `${count} permission(s)`;
      },
      flex: 1,
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
    this.appScopesSignal.set(this.appScopes || []);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['appScopes']) {
      this.appScopesSignal.set(this.appScopes || []);
    }
  }
}
