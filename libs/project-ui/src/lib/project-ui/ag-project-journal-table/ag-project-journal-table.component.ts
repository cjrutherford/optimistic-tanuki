import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
} from '@angular/core';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
  createDateColumn,
  CellClickedEvent,
} from '@optimistic-tanuki/ag-grid-ui';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import {
  CreateProjectJournal,
  ProjectJournal,
} from '@optimistic-tanuki/ui-models';
import { ProjectJournalFormComponent } from '../project-journal-form/project-journal-form.component';

/**
 * AG Grid-based project journal table component
 * Uses signals internally for reactive data flow
 */
@Component({
  selector: 'lib-ag-project-journal-table',
  imports: [
    AgGridUiComponent,
    ButtonComponent,
    ModalComponent,
    ProjectJournalFormComponent,
  ],
  templateUrl: './ag-project-journal-table.component.html',
  styleUrl: './ag-project-journal-table.component.scss',
})
export class AgProjectJournalTableComponent implements OnInit, OnChanges {
  // Traditional inputs/outputs for compatibility
  @Input() journals: ProjectJournal[] = [];
  @Input() loading = false;
  @Output() createJournalEntry = new EventEmitter<CreateProjectJournal>();
  @Output() editJournalEntry = new EventEmitter<ProjectJournal>();
  @Output() deleteJournalEntry = new EventEmitter<string>();

  // Internal state signals
  showModal = signal(false);
  showEditModal = signal(false);
  selectedJournal = signal<ProjectJournal | null>(null);

  // Internal signal for grid data
  private journalsSignal = signal<ProjectJournal[]>([]);

  // Computed signal for grid data
  gridData = computed(() => this.journalsSignal());

  columnDefs: ColDef[] = [
    {
      field: 'content',
      headerName: 'Content',
      flex: 3,
      minWidth: 250,
      filter: 'agTextColumnFilter',
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        whiteSpace: 'normal',
        lineHeight: '1.5',
        padding: '8px 12px',
      },
    },
    {
      field: 'analysis',
      headerName: 'Analysis',
      flex: 3,
      minWidth: 250,
      filter: 'agTextColumnFilter',
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        whiteSpace: 'normal',
        lineHeight: '1.5',
        padding: '8px 12px',
      },
    },
    createDateColumn('createdAt', 'Created', { flex: 1, minWidth: 120 }),
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
        this.selectedJournal.set(event.data);
      }
    },
  };

  ngOnInit(): void {
    this.journalsSignal.set(this.journals || []);
    console.log(
      'ag-project-journal-table initialized with',
      this.journals?.length || 0,
      'journals'
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['journals']) {
      this.journalsSignal.set(this.journals || []);
      console.log(
        'ag-project-journal-table journals updated:',
        this.journals?.length || 0
      );
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
    editBtn.style.border = '1px solid var(--accent)';
    editBtn.style.background = 'var(--accent)';
    editBtn.style.color = 'white';
    editBtn.onclick = () => this.onEdit(params.data);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = 'Delete';
    deleteBtn.style.padding = '4px 12px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.border = '1px solid var(--danger)';
    deleteBtn.style.background = 'var(--danger)';
    deleteBtn.style.color = 'white';
    deleteBtn.onclick = () => this.onDelete(params.data);

    container.appendChild(editBtn);
    container.appendChild(deleteBtn);

    return container;
  }

  onEdit(journal: ProjectJournal) {
    this.selectedJournal.set(journal);
    this.showEditModal.set(true);
  }

  onDelete(journal: ProjectJournal) {
    // TODO: Replace with modal component for better UX
    if (confirm(`Are you sure you want to delete this journal entry?`)) {
      this.deleteJournalEntry.emit(journal.id);
    }
  }

  entryUpdated(updatedEntry: Partial<ProjectJournal>) {
    const selected = this.selectedJournal();
    const projectId = selected?.projectId || '';
    const journalId = selected?.id || '';
    const profileId = selected?.profileId || '';
    const updateEntry: ProjectJournal = {
      id: journalId,
      projectId: projectId,
      profileId: profileId,
      ...selected,
      ...updatedEntry,
      content: updatedEntry.content || selected?.content || '',
      createdAt: selected?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.editJournalEntry.emit(updateEntry);
    this.showEditModal.set(false);
    this.selectedJournal.set(null);
  }

  entryCreated(newEntry: Partial<ProjectJournal>) {
    const newJournal: CreateProjectJournal = {
      projectId: newEntry.projectId || '',
      profileId: newEntry.profileId || '',
      content: newEntry.content || '',
      createdAt: newEntry.createdAt || new Date(),
    };
    this.createJournalEntry.emit(newJournal);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
