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
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileDto, ProfileTelosDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';

type UserGridRow = ProfileDto & {
  seededDemo: string;
  telosClass: string;
  telosLevel: string;
  telosStatus: string;
  telosSources: string;
};

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
        (selectionChange)="selectionChange.emit($event)"
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
    `,
  ],
})
export class AgUsersTableComponent implements OnInit, OnChanges {
  @ViewChild(AgGridUiComponent) private readonly grid?: AgGridUiComponent;

  @Input() users: ProfileDto[] = [];
  @Input() telosSummaries: Record<string, ProfileTelosDto | null> = {};
  @Input() seededProfileIds: string[] = [];
  @Input() loading = false;
  @Input() height = '600px';
  @Input() selectionResetKey = 0;
  @Output() manageRoles = new EventEmitter<ProfileDto>();
  @Output() selectionChange = new EventEmitter<ProfileDto[]>();
  @Output() manageTelos = new EventEmitter<ProfileDto>();

  // Internal signals
  private usersSignal = signal<ProfileDto[]>([]);
  private telosSummariesSignal = signal<Record<string, ProfileTelosDto | null>>(
    {}
  );
  private seededProfileIdsSignal = signal<Set<string>>(new Set());
  gridData = computed<UserGridRow[]>(() =>
    this.usersSignal().map((user) => {
      const telos = this.telosSummariesSignal()[user.id];
      const seeded = this.seededProfileIdsSignal().has(user.id);

      return {
        ...user,
        seededDemo: seeded ? 'Seeded' : '',
        telosClass: telos?.characterSheet.classLabel || 'Not built',
        telosLevel:
          telos?.generationStatus === 'ready'
            ? `${telos.characterSheet.level}`
            : '-',
        telosStatus: telos?.generationStatus || 'Unavailable',
        telosSources:
          typeof telos?.sourceCount === 'number' ? `${telos.sourceCount}` : '-',
      };
    })
  );

  columnDefs: ColDef[] = [
    {
      headerName: '',
      width: 64,
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      sortable: false,
      filter: false,
      resizable: false,
    },
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
      field: 'seededDemo',
      headerName: 'Demo',
      width: 110,
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
      field: 'telosClass',
      headerName: 'TELOS Class',
      width: 160,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'telosLevel',
      headerName: 'Level',
      width: 100,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'telosStatus',
      headerName: 'Status',
      width: 130,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'telosSources',
      headerName: 'Sources',
      width: 110,
      filter: 'agTextColumnFilter',
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

        const telosBtn = document.createElement('button');
        telosBtn.innerHTML = '🧭 TELOS';
        telosBtn.className = 'ag-grid-action-button';
        telosBtn.addEventListener('click', () => {
          this.manageTelos.emit(params.data);
        });

        container.appendChild(manageBtn);
        container.appendChild(telosBtn);
        return container;
      },
      width: 260,
      sortable: false,
      filter: false,
    },
  ];

  ngOnInit() {
    this.usersSignal.set(this.users || []);
    this.telosSummariesSignal.set(this.telosSummaries || {});
    this.seededProfileIdsSignal.set(new Set(this.seededProfileIds || []));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['users']) {
      this.usersSignal.set(this.users || []);
    }
    if (changes['telosSummaries']) {
      this.telosSummariesSignal.set(this.telosSummaries || {});
    }
    if (changes['seededProfileIds']) {
      this.seededProfileIdsSignal.set(new Set(this.seededProfileIds || []));
    }
    if (
      changes['selectionResetKey'] &&
      !changes['selectionResetKey'].firstChange
    ) {
      this.grid?.gridApi?.deselectAll?.();
      this.selectionChange.emit([]);
    }
  }
}
