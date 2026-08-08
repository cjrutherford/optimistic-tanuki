import {
  ButtonComponent,
  ModalComponent,
  TableCell,
  TableComponent,
  TableRowAction,
} from '@optimistic-tanuki/common-ui';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  signal,
  OnInit,
  OnChanges,
} from '@angular/core';
import { CreateTask, ProfileDto, Task } from '@optimistic-tanuki/ui-models';

import { TaskFormComponent } from '../task-form/task-form.component';

@Component({
  selector: 'lib-tasks-table',
  imports: [TableComponent, ButtonComponent, ModalComponent, TaskFormComponent],
  templateUrl: './tasks-table.component.html',
  styleUrl: './tasks-table.component.scss',
})
export class TasksTableComponent implements OnInit, OnChanges {
  cells = signal<TableCell[][]>([]);
  showModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  selectedTask = signal<Task | null>(null);
  @Output() createTask: EventEmitter<CreateTask> =
    new EventEmitter<CreateTask>();
  @Output() editTask: EventEmitter<Task> = new EventEmitter<Task>();
  @Output() deleteTask: EventEmitter<string> = new EventEmitter<string>();
  @Output() timerToggled: EventEmitter<Task> = new EventEmitter<Task>();
  @Input() tasks: Task[] = [];

  tableActions: TableRowAction[] = [
    {
      title: 'View',
      action: (index: number) => {
        this.setShowModal(index);
      },
    },
    {
      title: 'Edit',
      action: (index: number) => {
        console.log('Edit action for task at index:', index);
        this.setShowEditModal(this.tasks[index]);
      },
    },
    {
      title: 'Delete',
      action: (index: number) => {
        console.log('Delete action for task at index:', index);
        this.deleteTask.emit(this.tasks[index].id);
      },
    },
  ];

  ngOnInit() {
    console.log('TasksTableComponent initialized');
    this.setCellularData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tasks']) {
      console.log('Tasks changed:', changes['tasks'].currentValue);
      this.setCellularData();
    }
  }

  private setCellularData() {
    const currentCells: TableCell[][] = this.tasks?.map((task, index) => [
      { id: task.id, heading: 'Title', value: task.title },
      { id: task.id, heading: 'Description', value: task.description },
      { id: task.id, heading: 'Status', value: task.status },
      { id: task.id, heading: 'Assignee', value: task.assignee },
      {
        id: task.id,
        heading: 'Due Date',
        value: task.dueDate?.toLocaleString() || 'N/A',
      },
      { id: task.id, heading: 'Created By', value: task.createdBy },
      {
        id: task.id,
        heading: 'Created At',
        value: task.createdAt?.toLocaleDateString() || 'N/A',
      },
    ]);
    this.cells.set(currentCells);
  }

  setShowModal(index?: number) {
    this.showModal.set(true);
    if (index !== undefined) {
      const task = this.tasks[index];
      // Logic to populate the modal with the selected task details
      console.log('Selected task:', task);
    }
  }

  setShowEditModal(task: Task) {
    console.log('🚀 ~ TasksTableComponent ~ setShowEditModal ~ task:', task);
    this.selectedTask.set(task);
    this.showEditModal.set(true);
    console.log('Selected task for editing:', task);
  }

  onEditFormSubmit(task: Task) {
    console.log('Editing task:', task);
    this.editTask.emit(task);
    this.showEditModal.set(false);
  }

  onCreateFormSubmit(task: Task) {
    console.log('Creating task:', task);
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

  isTimerRunning(task: Task): boolean {
    return !!task.timeEntries?.some((entry) => !entry.endTime);
  }

  getActions(task: Task): TableRowAction[] {
    const isRunning = this.isTimerRunning(task);
    return [
      {
        title: isRunning ? 'Stop 🛑' : 'Start ⏱️',
        action: (index: number) => {
          this.onToggleTimer(index);
        },
      },
      ...this.tableActions,
    ];
  }

  onToggleTimer(index: number) {
    const task = this.tasks[index];
    this.timerToggled.emit(task);
  }
}
