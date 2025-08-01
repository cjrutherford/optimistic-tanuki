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
} from '@angular/core';
import { ProfileDto, Task } from '@optimistic-tanuki/ui-models';

import { CommonModule } from '@angular/common';
import { TaskFormComponent } from '../task-form/task-form.component';

@Component({
  selector: 'lib-tasks-table',
  imports: [
    CommonModule,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    TaskFormComponent,
  ],
  templateUrl: './tasks-table.component.html',
  styleUrl: './tasks-table.component.scss',
})
export class TasksTableComponent {
  cells = signal<TableCell[][]>([]);
  showModal = signal<boolean>(false);
  @Output() createTask: EventEmitter<Task> = new EventEmitter<Task>();
  @Output() editTask: EventEmitter<Task> = new EventEmitter<Task>();
  @Output() deleteTask: EventEmitter<string> = new EventEmitter<string>();
  @Input() tasks: Task[] = [
    {
      id: '1',
      title: 'Design homepage',
      description: 'Create wireframes for the homepage',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignee: 'Alice',
      projectId: 'project-1',
      dueDate: new Date('2024-07-01'),
      createdBy: 'admin',
      createdAt: new Date('2024-06-01'),
    },
    {
      id: '2',
      title: 'Implement login',
      description: 'Develop authentication module',
      status: 'TODO',
      priority: 'HIGH',
      assignee: 'Bob',
      projectId: 'project-1',
      dueDate: new Date('2024-07-05'),
      createdBy: 'admin',
      createdAt: new Date('2024-06-02'),
    },
    {
      id: '3',
      title: 'Set up database',
      description: 'Initialize PostgreSQL instance',
      status: 'DONE',
      priority: 'LOW',
      assignee: 'Charlie',
      projectId: 'project-2',
      dueDate: new Date('2024-06-15'),
      createdBy: 'admin',
      createdAt: new Date('2024-06-03'),
    },
    {
      id: '4',
      title: 'Write tests',
      description: 'Add unit tests for user service',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM_HIGH',
      assignee: 'Dana',
      projectId: 'project-2',
      dueDate: new Date('2024-07-10'),
      createdBy: 'admin',
      createdAt: new Date('2024-06-04'),
    },
    {
      id: '5',
      title: 'Deploy to staging',
      description: 'Deploy latest build to staging environment',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'Eve',
      projectId: 'project-3',
      dueDate: new Date('2024-07-15'),
      createdBy: 'admin',
      createdAt: new Date('2024-06-05'),
    },
  ];

  tableActions: TableRowAction[] = [
    {
      title: 'View',
      action: (index: number) => {
        console.log('View action for task at index:', index);
        // Implement view logic here
      },
    },
    {
      title: 'Edit',
      action: (index: number) => {
        console.log('Edit action for task at index:', index);
        this.editTask.emit(this.tasks[index]);
        this.setShowModal(index);
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
        value: new Date().toLocaleDateString(),
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

  onCreateFormSubmit(task: Task) {
    console.log('Creating task:', task);
    this.createTask.emit(task);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
