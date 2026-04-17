import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { ICellRendererParams } from 'ag-grid-community';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
  createDateColumn,
  createStatusColumn,
  CellClickedEvent,
} from '@optimistic-tanuki/ag-grid-ui';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { CreateTask, Task, TaskTag } from '@optimistic-tanuki/ui-models';
import { TaskFormComponent } from '../task-form/task-form.component';

/**
 * AG Grid-based tasks table component
 * Replaces the old table-based implementation with AG Grid
 * Uses signals internally for reactive data flow
 */
@Component({
  selector: 'lib-ag-tasks-table',
  imports: [
    AgGridUiComponent,
    ButtonComponent,
    ModalComponent,
    TaskFormComponent,
  ],
  templateUrl: './ag-tasks-table.component.html',
  styleUrls: ['./ag-tasks-table.component.scss'],
})
export class AgTasksTableComponent implements OnInit, OnChanges, OnDestroy {
  // Traditional inputs/outputs for compatibility with parent components
  @Input() tasks: Task[] = [];
  @Input() loading = false;
  @Output() createTask = new EventEmitter<CreateTask>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<string>();
  @Output() startTimer = new EventEmitter<string>();
  @Output() stopTimer = new EventEmitter<string>();

  // Internal state signals for reactive UI
  showModal = signal(false);
  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);

  // Internal signal for grid data (reactive to input changes)
  private tasksSignal = signal<Task[]>([]);

  // Computed signal for grid data (allows for filtering, sorting, etc.)
  gridData = computed(() => this.tasksSignal());

  // Timer interval for updating active timer displays
  private timerInterval: NodeJS.Timeout | null = null;

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
      field: 'tags',
      headerName: 'Tags',
      flex: 1,
      minWidth: 150,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        const tags: TaskTag[] = params.value || [];
        if (tags.length === 0) return '-';
        
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '4px';
        container.style.flexWrap = 'wrap';
        container.style.alignItems = 'center';
        
        tags.forEach((tag: TaskTag) => {
          const tagBadge = document.createElement('span');
          tagBadge.innerText = tag.name;
          tagBadge.style.padding = '2px 8px';
          tagBadge.style.borderRadius = '12px';
          tagBadge.style.fontSize = '0.75rem';
          tagBadge.style.backgroundColor = tag.color || '#3498db';
          tagBadge.style.color = 'white';
          tagBadge.style.whiteSpace = 'nowrap';
          container.appendChild(tagBadge);
        });
        
        return container;
      },
    },
    {
      field: 'timeInfo',
      headerName: 'Time Spent',
      flex: 1,
      minWidth: 180,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const task = params.data as Task;
        return this.timeInfoRenderer(task);
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
      maxWidth: 280,
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
    console.log(
      'ag-tasks-table initialized with',
      this.tasks?.length || 0,
      'tasks'
    );
    // Start interval to update active timer displays every second
    this.startTimerUpdates();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.tasksSignal.set(this.tasks || []);
      console.log('ag-tasks-table tasks updated:', this.tasks?.length || 0);
    }
  }

  ngOnDestroy(): void {
    this.stopTimerUpdates();
  }

  /**
   * Start the interval that updates active timer displays
   */
  private startTimerUpdates(): void {
    // Clear any existing interval first
    this.stopTimerUpdates();
    
    // Update every second
    this.timerInterval = setInterval(() => {
      // Trigger AG Grid to refresh cells with active timers
      this.refreshTimerCells();
    }, 1000);
  }

  /**
   * Stop the timer update interval
   */
  private stopTimerUpdates(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Track if we had active timers in the previous check
  private hadActiveTimers = false;

  /**
   * Refresh grid cells that display timer information
   */
  private refreshTimerCells(): void {
    // This will be called every second to refresh timer displays
    // AG Grid will automatically re-render cells when data changes
    const tasks = this.tasksSignal();
    const hasActiveTimers = tasks.some(task => 
      task.timeEntries?.some(entry => !entry.endTime)
    );
    
    // Update if there are active timers OR if we just stopped a timer
    // (transition from active to inactive needs one final refresh)
    if (hasActiveTimers || this.hadActiveTimers) {
      // Force a signal update to trigger re-render
      this.tasksSignal.set([...tasks]);
    }
    
    // Track the current state for next iteration
    this.hadActiveTimers = hasActiveTimers;
  }

  /**
   * Format seconds to a human-readable time string
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Calculate current elapsed time for an active timer
   */
  private getCurrentElapsedTime(startTime: Date): number {
    const now = new Date();
    const start = new Date(startTime);
    return Math.floor((now.getTime() - start.getTime()) / 1000);
  }

  /**
   * Custom cell renderer for time info column
   * Shows session time (if active) and total task time
   */
  private timeInfoRenderer(task: Task): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '2px';
    container.style.fontSize = '0.875rem';

    // Find active timer entry
    const activeEntry = task.timeEntries?.find(entry => !entry.endTime);
    
    // Calculate total time from all completed entries
    let totalSeconds = 0;
    task.timeEntries?.forEach(entry => {
      if (entry.elapsedSeconds) {
        totalSeconds += entry.elapsedSeconds;
      }
    });

    // If there's an active timer, add its current elapsed time
    let sessionSeconds = 0;
    if (activeEntry) {
      sessionSeconds = this.getCurrentElapsedTime(activeEntry.startTime);
      
      // Session time display (active timer counting up)
      const sessionDiv = document.createElement('div');
      sessionDiv.style.color = 'var(--success)';
      sessionDiv.style.fontWeight = 'bold';
      sessionDiv.innerHTML = `🔴 Session: ${this.formatTime(sessionSeconds)}`;
      container.appendChild(sessionDiv);
    }

    // Total time display
    const totalDiv = document.createElement('div');
    const totalWithSession = totalSeconds + sessionSeconds;
    totalDiv.style.color = activeEntry ? 'var(--text-secondary)' : 'var(--text-primary)';
    totalDiv.innerHTML = `Total: ${this.formatTime(totalWithSession)}`;
    container.appendChild(totalDiv);

    // If no time tracked yet
    if (totalWithSession === 0) {
      container.innerHTML = '<span style="color: var(--text-secondary)">No time tracked</span>';
    }

    return container;
  }

  /**
   * Custom cell renderer for actions column
   */
  actionsRenderer(params: ICellRendererParams) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';

    // Check if there's an active time entry
    const task = params.data as Task;
    const hasActiveTimer = task.timeEntries?.some(entry => !entry.endTime);

    // Timer button (Start or Stop)
    const timerBtn = document.createElement('button');
    timerBtn.innerText = hasActiveTimer ? '⏸ Stop' : '▶ Start';
    timerBtn.style.padding = '4px 12px';
    timerBtn.style.cursor = 'pointer';
    timerBtn.style.borderRadius = '4px';
    timerBtn.style.border = hasActiveTimer ? '1px solid var(--danger)' : '1px solid var(--success)';
    timerBtn.style.background = hasActiveTimer ? 'var(--danger)' : 'var(--success)';
    timerBtn.style.color = 'white';
    timerBtn.style.fontSize = '0.875rem';
    timerBtn.onclick = () => {
      if (hasActiveTimer) {
        const activeEntry = task.timeEntries?.find(entry => !entry.endTime);
        if (activeEntry) {
          this.stopTimer.emit(activeEntry.id);
        }
      } else {
        this.startTimer.emit(task.id);
      }
    };

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

    container.appendChild(timerBtn);
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
