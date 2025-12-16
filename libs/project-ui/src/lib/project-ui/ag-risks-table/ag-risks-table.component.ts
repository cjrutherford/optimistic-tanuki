import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
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
import { CreateRisk, Risk } from '@optimistic-tanuki/ui-models';
import { RiskFormComponent } from '../risk-form/risk-form.component';

/**
 * AG Grid-based risks table component
 */
@Component({
  selector: 'lib-ag-risks-table',
  imports: [AgGridUiComponent, ButtonComponent, ModalComponent, RiskFormComponent],
  templateUrl: './ag-risks-table.component.html',
  styleUrl: './ag-risks-table.component.scss',
})
export class AgRisksTableComponent implements OnInit, OnChanges {
  @Input() risks: Risk[] = [];
  @Output() createRisk = new EventEmitter<CreateRisk>();
  @Output() editRisk = new EventEmitter<Risk>();
  @Output() deleteRisk = new EventEmitter<string>();

  showModal = false;
  showEditModal = false;
  selectedRisk: Risk | null = null;

  columnDefs: ColDef[] = [
    {
      field: 'description',
      headerName: 'Description',
      flex: 3,
      minWidth: 200,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'impact',
      headerName: 'Impact',
      flex: 1,
      minWidth: 100,
      filter: 'agSetColumnFilter',
      cellStyle: (params) => {
        const impact = params.value;
        if (impact === 'HIGH' || impact === 'CRITICAL') {
          return { color: '#e53e3e', fontWeight: 'bold' };
        } else if (impact === 'MEDIUM') {
          return { color: '#d69e2e', fontWeight: 'bold' };
        }
        return { color: '#48bb78', fontWeight: 'bold' };
      },
    },
    {
      field: 'likelihood',
      headerName: 'Likelihood',
      flex: 1,
      minWidth: 120,
      filter: 'agSetColumnFilter',
      cellStyle: (params) => {
        const likelihood = params.value;
        if (likelihood === 'CERTAIN' || likelihood === 'LIKELY') {
          return { color: '#e53e3e', fontWeight: 'bold' };
        } else if (likelihood === 'POSSIBLE') {
          return { color: '#d69e2e', fontWeight: 'bold' };
        }
        return { color: '#48bb78', fontWeight: 'bold' };
      },
    },
    createStatusColumn('status', 'Status'),
    {
      field: 'createdBy',
      headerName: 'Created By',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
    },
    createDateColumn('createdAt', 'Created', { flex: 1, minWidth: 120 }),
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
    rowSelection: 'single',
    onCellClicked: (event: CellClickedEvent) => {
      if (event.column.getColId() !== 'Actions') {
        this.selectedRisk = event.data;
      }
    },
  };

  ngOnInit() {
    // Component initialized
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['risks']) {
      // Risks updated
    }
  }

  actionsRenderer(params: any) {
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

  onEdit(risk: Risk) {
    this.selectedRisk = risk;
    this.showEditModal = true;
  }

  onDelete(risk: Risk) {
    // TODO: Replace with modal component for better UX
    if (confirm(`Are you sure you want to delete this risk?`)) {
      this.deleteRisk.emit(risk.id);
    }
  }

  onEditFormSubmit(risk: Risk) {
    this.editRisk.emit(risk);
    this.showEditModal = false;
  }

  onCreateFormSubmit(risk: Risk) {
    // Convert Risk to CreateRisk for creation
    const newRisk: CreateRisk = {
      description: risk.description,
      impact: risk.impact,
      likelihood: risk.likelihood,
      projectId: risk.projectId,
      status: risk.status || 'OPEN',
      createdBy: risk.createdBy || '',
    };
    this.createRisk.emit(newRisk);
    this.closeModal();
  }

  closeModal() {
    this.showModal = false;
  }
}
