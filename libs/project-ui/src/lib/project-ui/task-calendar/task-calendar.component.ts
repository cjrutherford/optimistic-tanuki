import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { Task, CreateTask } from '@optimistic-tanuki/ui-models';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { TaskFormComponent } from '../task-form/task-form.component';

/**
 * Calendar view component for tasks
 * Uses FullCalendar to display tasks in a calendar format
 */
@Component({
  selector: 'lib-task-calendar',
  standalone: true,
  imports: [CommonModule, FullCalendarModule, ButtonComponent, ModalComponent, TaskFormComponent],
  templateUrl: './task-calendar.component.html',
  styleUrls: ['./task-calendar.component.scss'],
})
export class TaskCalendarComponent implements OnInit, OnChanges {
  @Input() tasks: Task[] = [];
  @Input() loading: boolean = false;
  @Output() createTask = new EventEmitter<CreateTask>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<string>();
  @Output() dateSelected = new EventEmitter<Date>();

  showModal = signal(false);
  showEditModal = signal(false);
  selectedTask = signal<Task | null>(null);
  selectedDate = signal<Date | null>(null);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    weekends: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    eventClick: this.handleEventClick.bind(this),
    select: this.handleDateSelect.bind(this),
    events: [],
    eventColor: '#378006',
    eventTextColor: '#ffffff',
    eventClassNames: (arg) => {
      const task = this.tasks.find(t => t.id === arg.event.id);
      if (!task) return [];
      
      const classes = ['fc-event-custom'];
      
      // Add status-based class
      if (task.status === 'DONE') {
        classes.push('fc-event-done');
      } else if (task.status === 'IN_PROGRESS') {
        classes.push('fc-event-in-progress');
      } else if (task.status === 'TODO') {
        classes.push('fc-event-todo');
      }
      
      // Add priority-based class
      if (task.priority === 'HIGH' || task.priority === 'CRITICAL') {
        classes.push('fc-event-high-priority');
      }
      
      return classes;
    }
  };

  ngOnInit(): void {
    this.updateCalendarEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.updateCalendarEvents();
    }
  }

  private updateCalendarEvents(): void {
    const events = this.tasks.map(task => ({
      id: task.id,
      title: task.title,
      start: task.dueDate || task.createdAt,
      end: task.dueDate || task.createdAt,
      extendedProps: {
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
      },
      backgroundColor: this.getTaskColor(task),
      borderColor: this.getTaskBorderColor(task),
    }));

    this.calendarOptions = {
      ...this.calendarOptions,
      events: events,
    };
  }

  private getTaskColor(task: Task): string {
    if (task.status === 'DONE') {
      return '#28a745'; // Green
    } else if (task.status === 'IN_PROGRESS') {
      return '#007bff'; // Blue
    } else if (task.status === 'ARCHIVED') {
      return '#6c757d'; // Gray
    }
    
    // Priority-based colors for TODO tasks
    if (task.priority === 'HIGH') {
      return '#dc3545'; // Red
    } else if (task.priority === 'MEDIUM_HIGH') {
      return '#fd7e14'; // Orange
    } else if (task.priority === 'MEDIUM') {
      return '#ffc107'; // Yellow
    }
    
    return '#17a2b8'; // Teal for low priority
  }

  private getTaskBorderColor(task: Task): string {
    return this.getTaskColor(task);
  }

  handleEventClick(clickInfo: EventClickArg): void {
    const task = this.tasks.find(t => t.id === clickInfo.event.id);
    if (task) {
      this.selectedTask.set(task);
      this.showEditModal.set(true);
    }
  }

  handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate.set(selectInfo.start);
    this.dateSelected.emit(selectInfo.start);
    this.showModal.set(true);
  }

  onEditFormSubmit(task: Task): void {
    this.editTask.emit(task);
    this.showEditModal.set(false);
  }

  onCreateFormSubmit(task: Task): void {
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

  closeModal(): void {
    this.showModal.set(false);
    this.selectedDate.set(null);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedTask.set(null);
  }
}
