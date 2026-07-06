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
import { ColDef } from 'ag-grid-community';
import { AgGridUiComponent } from '@optimistic-tanuki/ag-grid-ui/ag-grid-ui.component';

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
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--surface, #ffffff) 92%, transparent),
          color-mix(in srgb, var(--accent, #2563eb) 8%, var(--surface, #ffffff))
        );
        color: var(--foreground, #111827);
        border-radius: var(--personality-card-radius, 12px);
        border: var(--personality-border-width, 1px)
          var(--personality-border-style, solid)
          color-mix(
            in srgb,
            var(--border-color, #d6d6d6) 86%,
            var(--accent, #2563eb)
          );
        box-shadow: var(
          --personality-card-shadow,
          0 10px 24px rgba(0, 0, 0, 0.08)
        );
      }

      .action-group {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .create-button {
        padding: 8px 16px;
        background: var(--gradient-primary, var(--accent, #2563eb));
        color: var(--on-primary, var(--primary-foreground, #ffffff));
        border: none;
        border-radius: var(--personality-button-radius, 8px);
        cursor: pointer;
        font-size: 14px;
        font-weight: var(--personality-button-font-weight, 600);
        text-transform: var(--personality-button-text-transform, none);
        transition: transform var(--animation-duration-fast, 150ms)
            var(--animation-easing, ease),
          filter var(--animation-duration-fast, 150ms)
            var(--animation-easing, ease);
      }

      .create-button:hover {
        filter: brightness(1.04);
        transform: translateY(-1px);
      }
    `,
  ],
})
export class AgAppScopesTableComponent implements OnInit, OnChanges {
  @Input() appScopes: AppScopeDto[] = [];
  @Input() permissionCounts: Map<string, number> = new Map();
  @Input() loading = false;
  @Input() height = '600px';
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
        badge.style.background = active
          ? 'color-mix(in srgb, var(--success, #15803d) 14%, var(--surface, #ffffff))'
          : 'color-mix(in srgb, var(--warning, #b45309) 16%, var(--surface, #ffffff))';
        badge.style.color = active
          ? 'color-mix(in srgb, var(--success, #15803d) 82%, var(--foreground, #111827))'
          : 'color-mix(in srgb, var(--warning, #b45309) 82%, var(--foreground, #111827))';
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
