import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { ICellRendererParams } from 'ag-grid-community';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
  createDateColumn,
  createStatusColumn,
  CellClickedEvent,
} from '@optimistic-tanuki/ag-grid-ui';
import {
  ButtonComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';
import { Change, CreateChange } from '@optimistic-tanuki/ui-models';
import { ChangeFormComponent } from '../change-form/change-form.component';

/**
 * AG Grid-based changes table component
 * Uses signals internally for reactive data flow
 */
@Component({
  selector: 'lib-ag-changes-table',
  imports: [AgGridUiComponent, ButtonComponent, ModalComponent, ChangeFormComponent],
  templateUrl: './ag-changes-table.component.html',
  styleUrls: ['./ag-changes-table.component.scss'],
})
export class AgChangesTableComponent implements OnInit, OnChanges {
  // Traditional inputs/outputs for compatibility
  @Input() changes: Change[] = [];
  @Input() loading: boolean = false;
  @Output() createChange = new EventEmitter<CreateChange>();
  @Output() editChange = new EventEmitter<Change>();
  @Output() deleteChange = new EventEmitter<string>();

  // Internal state signals
  showModal = signal(false);
  showEditModal = signal(false);
  selectedChange = signal<Change | null>(null);
  
  // Internal signal for grid data
  private changesSignal = signal<Change[]>([]);
  
  // Computed signal for grid data
  gridData = computed(() => this.changesSignal());

  columnDefs: ColDef[] = [
    {
      field: 'changeDescription',
      headerName: 'Description',
      flex: 3,
      minWidth: 200,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'changeType',
      headerName: 'Type',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      cellStyle: { fontWeight: 'bold', textTransform: 'uppercase' },
    },
    createStatusColumn('changeStatus', 'Status'),
    createDateColumn('changeDate', 'Change Date', { flex: 1, minWidth: 120 }),
    {
      field: 'requestor',
      headerName: 'Requestor',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'approver',
      headerName: 'Approver',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'resolution',
      headerName: 'Resolution',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      cellStyle: (params) => {
        const resolution = params.value;
        if (resolution === 'APPROVED') {
          return { color: '#48bb78', fontWeight: 'bold' };
        } else if (resolution === 'REJECTED') {
          return { color: '#e53e3e', fontWeight: 'bold' };
        }
        return { color: '#d69e2e', fontWeight: 'bold' };
      },
    },
    createDateColumn('updatedAt', 'Updated', { flex: 1, minWidth: 120 }),
    {
      headerName: 'Actions',
      cellRenderer: this.actionsRenderer.bind(this),
      sortable: false,
      filter: false,
      resizable: false,
      maxWidth: 200,
      pinned: 'right',
    },
  ];

  gridOptions: GridOptions = {
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
    rowSelection: { mode: 'singleRow' },
    onCellClicked: (event: CellClickedEvent) => {
      if (event.column.getColId() !== 'Actions') {
        this.selectedChange.set(event.data);
      }
    },
  };

  ngOnInit(): void {
    this.changesSignal.set(this.changes || []);
    console.log('ag-changes-table initialized with', this.changes?.length || 0, 'changes');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['changes']) {
      this.changesSignal.set(this.changes || []);
      console.log('ag-changes-table changes updated:', this.changes?.length || 0);
    }
  }

  actionsRenderer(params: ICellRendererParams) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';

    const editBtn = document.createElement('button');
    editBtn.innerText = 'Edit';
    editBtn.style.padding = '4px 12px';
    editBtn.style.cursor = 'pointer';
    editBtn.style.borderRadius = '4px';
    editBtn.style.border = '1px solid var(--ag-accent-color)';
    editBtn.style.background = 'var(--ag-accent-color)';
    editBtn.style.color = 'white';
    editBtn.onclick = () => this.onEdit(params.data);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = 'Delete';
    deleteBtn.style.padding = '4px 12px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.border = '1px solid #e53e3e';
    deleteBtn.style.background = '#e53e3e';
    deleteBtn.style.color = 'white';
    deleteBtn.onclick = () => this.onDelete(params.data);

    container.appendChild(editBtn);
    container.appendChild(deleteBtn);

    return container;
  }

  onEdit(change: Change) {
    this.selectedChange.set(change);
    this.showEditModal.set(true);
  }

  onDelete(change: Change) {
    // TODO: Replace with modal component for better UX
    if (confirm(`Are you sure you want to delete this change?`)) {
      this.deleteChange.emit(change.id);
    }
  }

  onEditFormSubmit(change: Partial<Change>) {
    const selected = this.selectedChange();
    const changeId = selected?.id || '';
    const updatedChange: Change = {
      ...(selected as Change),
      ...(change as Change),
      id: changeId,
      updatedAt: new Date(),
    };
    this.editChange.emit(updatedChange);
    this.showEditModal.set(false);
  }

  onCreateFormSubmit(change: Partial<Change>) {
    const {
      changeType = 'ADDITION',
      changeDescription = '',
      changeStatus = 'PENDING',
      changeDate = new Date(),
      requestor = '',
      approver = '',
      resolution = 'PENDING',
      projectId = ''
    } = change;
    const newChange: CreateChange = {
      changeType,
      changeDescription,
      changeStatus,
      changeDate,
      requestor,
      approver,
      resolution,
      projectId
    };
    this.createChange.emit(newChange);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
