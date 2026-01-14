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
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

@Component({
  selector: 'app-ag-users-table',
  standalone: true,
  imports: [CommonModule, AgGridUiComponent],
  template: `
    <div class="ag-users-table-container">
      <div class="action-group">
        <!-- Actions can be added here if needed -->
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
      .ag-users-table-container {
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
    `,
  ],
})
export class AgUsersTableComponent implements OnInit, OnChanges {
  @Input() users: ProfileDto[] = [];
  @Input() loading: boolean = false;
  @Input() height: string = '600px';
  @Output() manageRoles = new EventEmitter<ProfileDto>();

  // Internal signals
  private usersSignal = signal<ProfileDto[]>([]);
  gridData = computed(() => this.usersSignal());

  columnDefs: ColDef[] = [
    {
      field: 'profileName',
      headerName: 'Name',
      flex: 2,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'userId',
      headerName: 'User ID',
      flex: 2,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'bio',
      headerName: 'Bio',
      flex: 3,
      filter: 'agTextColumnFilter',
      valueFormatter: (params) => params.value || 'N/A',
    },
    {
      headerName: 'Actions',
      cellRenderer: (params: any) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';

        const manageBtn = document.createElement('button');
        manageBtn.innerHTML = '⚙️ Manage Roles';
        manageBtn.className = 'ag-grid-action-button';
        manageBtn.addEventListener('click', () => {
          this.manageRoles.emit(params.data);
        });

        container.appendChild(manageBtn);
        return container;
      },
      width: 150,
      sortable: false,
      filter: false,
    },
  ];

  ngOnInit() {
    this.usersSignal.set(this.users || []);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['users']) {
      this.usersSignal.set(this.users || []);
    }
  }
}
