import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoteDto, NoteStatus, TaskDto, TaskStatus, TimerDto, TimerStatus } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
  ],
})
export class TasksComponent implements OnInit {
  tasks: TaskDto[] = [];
  selectedTask: TaskDto | null = null;
  timers: TimerDto[] = [];
  notes: NoteDto[] = [];
  filteredTimers: TimerDto[] = [];
  filteredNotes: NoteDto[] = [];
  selectedTabIndex = 0;

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks() {
    // Load tasks from the server or service
    this.tasks = [
      {
        id: '1',
        title: 'Task 1',
        description: 'Description for Task 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        status: TaskStatus.Draft,
        timers: ['1'],
        notes: ['1'],
      },
      {
        id: '2',
        title: 'Task 2',
        description: 'Description for Task 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        status: TaskStatus.Draft,
        timers: ["2"],
        notes: ["2"],
      },
      {
        id: '3',
        title: 'Task 3',
        description: 'Description for Task 3',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        status: TaskStatus.Draft,
        timers: ["3"],
        notes: ["3"],
      },
    ];

    this.timers = [
      {
        id: '1',
        taskId: '1',
        duration: 120,
        start: new Date(),
        end: new Date(),
        description: 'Timer for Task 1',
        status: TimerStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      },
      {
        id: '2',
        taskId: '2',
        duration: 60,
        start: new Date(),
        end: new Date(),
        description: 'Timer for Task 2',
        status: TimerStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      },
      {
        id: '3',
        taskId: '3',
        duration: 90,
        start: new Date(),
        end: new Date(),
        description: 'Timer for Task 3',
        status: TimerStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      },
    ];

    this.notes = [
      {
        id: '1',
        taskId: '1',
        contents: 'Note for Task 1',
        userId: 'a',
        status: NoteStatus.Draft,
        projectId: 'alskdjf;la',
        description: 'not that interesting',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Note 1',
        task: 'xxx',
      },
      {
        id: '2',
        taskId: '2',
        contents: 'Note for Task 2',
        userId: 'a',
        status: NoteStatus.Draft,
        projectId: 'alskdjf;la',
        description: 'not that interesting',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Note 1',
        task: 'xxx',
      },
      {
        id: '3',
        taskId: '3',
        contents: 'Note for Task 3',
        userId: 'a',
        status: NoteStatus.Draft,
        projectId: 'alskdjf;la',
        description: 'not that interesting',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Note 1',
        task: 'xxx',
      },
    ];
  }

  selectTask(task: TaskDto) {
    this.selectedTask = task;
    this.filteredTimers = this.timers.filter(timer => timer.taskId === task.id);
    this.filteredNotes = this.notes.filter(note => note.taskId === task.id);
    this.selectedTabIndex = 0; // Reset to the first tab
  }

  getFilteredTimers(taskId: string) {
    return this.timers.filter(timer => timer.taskId === taskId);
  }

  getFilteredNotes(taskId: string) {
    return this.notes.filter(note => note.taskId === taskId);
  }
}
