import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Task, CreateTask } from '@optimistic-tanuki/ui-models';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { TaskFormComponent } from '../task-form/task-form.component';

interface KanbanColumn {
  id: string;
  title: string;
  status: Task['status'];
  tasks: Task[];
}

/**
 * Kanban board component for tasks
 * Displays tasks in columns based on their status
 * Supports drag-and-drop to change task status
 */
@Component({
  selector: 'lib-task-kanban',
  standalone: true,
  imports: [CommonModule, DragDropModule, ButtonComponent, ModalComponent, TaskFormComponent],
  templateUrl: './task-kanban.component.html',
  styleUrls: ['./task-kanban.component.scss'],
})
export class TaskKanbanComponent implements OnInit, OnChanges {
  @Input() tasks: Task[] = [];
  @Input() loading: boolean = false;
  @Output() createTask = new EventEmitter<CreateTask>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<string>();
  @Output() statusChanged = new EventEmitter<{ taskId: string; newStatus: Task['status'] }>();

  showModal = signal(false);
  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);
  selectedColumnStatus = signal<Task['status'] | null>(null);

  columns = signal<KanbanColumn[]>([
    { id: 'todo', title: 'To Do', status: 'TODO', tasks: [] },
    { id: 'in-progress', title: 'In Progress', status: 'IN_PROGRESS', tasks: [] },
    { id: 'done', title: 'Done', status: 'DONE', tasks: [] },
    { id: 'archived', title: 'Archived', status: 'ARCHIVED', tasks: [] },
  ]);

  // Computed property for connected drop lists
  connectedDropLists = computed(() => this.columns().map(c => c.id));

  ngOnInit(): void {
    this.updateKanbanColumns();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.updateKanbanColumns();
    }
  }

  private updateKanbanColumns(): void {
    const newColumns = this.columns().map(column => ({
      ...column,
      tasks: this.tasks.filter(task => task.status === column.status),
    }));
    this.columns.set(newColumns);
  }

  drop(event: CdkDragDrop<Task[]>, targetColumn: KanbanColumn): void {
    if (event.previousContainer === event.container) {
      // Reorder within the same column
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Move to a different column
      const task = event.previousContainer.data[event.previousIndex];
      
      // Transfer the item
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update the task status
      const updatedTask = { ...task, status: targetColumn.status };
      this.editTask.emit(updatedTask);
      this.statusChanged.emit({ taskId: task.id, newStatus: targetColumn.status });
    }
  }

  onTaskClick(task: Task): void {
    this.selectedTask.set(task);
    this.showEditModal.set(true);
  }

  onAddTask(column: KanbanColumn): void {
    this.selectedColumnStatus.set(column.status);
    this.showModal.set(true);
  }

  onEditFormSubmit(task: any): void {
    this.editTask.emit(task as Task);
    this.showEditModal.set(false);
  }

  onCreateFormSubmit(task: any): void {
    const newTask: CreateTask = {
      title: task.title,
      description: task.description,
      status: this.selectedColumnStatus() || 'TODO',
      priority: task.priority,
      projectId: task.projectId,
      createdBy: task.createdBy,
    };
    this.createTask.emit(newTask);
    this.closeModal();
  }

  onDeleteTask(taskId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this task?')) {
      this.deleteTask.emit(taskId);
    }
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedColumnStatus.set(null);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedTask.set(null);
  }

  getTaskPriorityClass(priority: Task['priority']): string {
    switch (priority) {
      case 'HIGH':
        return 'priority-high';
      case 'MEDIUM_HIGH':
        return 'priority-medium-high';
      case 'MEDIUM':
        return 'priority-medium';
      case 'MEDIUM_LOW':
        return 'priority-medium-low';
      case 'LOW':
        return 'priority-low';
      default:
        return '';
    }
  }

  getTaskCount(column: KanbanColumn): number {
    return column.tasks.length;
  }
}
