import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
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
import { CreateTask, Task } from '@optimistic-tanuki/ui-models';
import { TaskFormComponent } from '../task-form/task-form.component';

/**
 * AG Grid-based tasks table component
 * Replaces the old table-based implementation with AG Grid
 * Uses signals internally for reactive data flow
 */
@Component({
  selector: 'lib-ag-tasks-table',
  imports: [AgGridUiComponent, ButtonComponent, ModalComponent, TaskFormComponent],
  templateUrl: './ag-tasks-table.component.html',
  styleUrls: ['./ag-tasks-table.component.scss'],
})
export class AgTasksTableComponent implements OnInit, OnChanges {
  // Traditional inputs/outputs for compatibility with parent components
  @Input() tasks: Task[] = [];
  @Input() loading: boolean = false;
  @Output() createTask = new EventEmitter<CreateTask>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<string>();

  // Internal state signals for reactive UI
  showModal = signal(false);
  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);
  
  // Internal signal for grid data (reactive to input changes)
  private tasksSignal = signal<Task[]>([]);
  
  // Computed signal for grid data (allows for filtering, sorting, etc.)
  gridData = computed(() => this.tasksSignal());

  columnDefs: ColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 2,
      minWidth: 150,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 3,
      minWidth: 200,
      filter: 'agTextColumnFilter',
    },
    createStatusColumn('status', 'Status'),
    {
      field: 'priority',
      headerName: 'Priority',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      cellStyle: (params) => {
        const priority = params.value;
        if (priority === 'HIGH' || priority === 'CRITICAL') {
          return { color: 'var(--danger)', fontWeight: 'bold' };
        } else if (priority === 'MEDIUM_HIGH') {
          return { color: 'var(--warning)', fontWeight: 'bold' };
        } else if (priority === 'MEDIUM') {
          return { color: 'var(--warning)', fontWeight: 'bold' };
        }
        return { color: 'var(--success)', fontWeight: 'bold' };
      },
    },
    {
      field: 'assignee',
      headerName: 'Assignee',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
    },
    createDateColumn('dueDate', 'Due Date', { flex: 1, minWidth: 120 }),
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
    rowSelection: { mode: 'singleRow' },
    onCellClicked: (event: CellClickedEvent) => {
      // Don't trigger row selection on actions column
      if (event.column.getColId() !== 'Actions') {
        this.selectedTask.set(event.data);
      }
    },
  };

  ngOnInit(): void {
    this.tasksSignal.set(this.tasks || []);
    console.log('ag-tasks-table initialized with', this.tasks?.length || 0, 'tasks');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.tasksSignal.set(this.tasks || []);
      console.log('ag-tasks-table tasks updated:', this.tasks?.length || 0);
    }
  }

  /**
   * Custom cell renderer for actions column
   */
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

  onEdit(task: Task) {
    this.selectedTask.set(task);
    this.showEditModal.set(true);
  }

  onDelete(task: Task) {
    // TODO: Replace with modal component for better UX
    // For now, using native confirm as a temporary solution
    if (confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      this.deleteTask.emit(task.id);
    }
  }

  onEditFormSubmit(task: Task) {
    this.editTask.emit(task);
    this.showEditModal.set(false);
  }

  onCreateFormSubmit(task: Task) {
    const newTask: CreateTask = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      createdBy: task.createdBy,
    };
    this.createTask.emit(newTask);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
