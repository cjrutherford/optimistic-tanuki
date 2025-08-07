import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoteDto, NoteStatus, TaskDto, TaskStatus, TimerDto, TimerStatus } from '@optimistic-tanuki/ui-models';


/**
 * Component for displaying and managing tasks, timers, and notes.
 */
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
  /**
   * Array of tasks.
   */
  tasks: TaskDto[] = [];
  /**
   * The currently selected task.
   */
  selectedTask: TaskDto | null = null;
  /**
   * Array of timers.
   */
  timers: TimerDto[] = [];
  /**
   * Array of notes.
   */
  notes: NoteDto[] = [];
  /**
   * Filtered array of timers based on the selected task.
   */
  filteredTimers: TimerDto[] = [];
  /**
   * Filtered array of notes based on the selected task.
   */
  filteredNotes: NoteDto[] = [];
  /**
   * The index of the currently selected tab.
   */
  selectedTabIndex = 0;

  /**
   * Initializes the component and loads tasks.
   */
  ngOnInit(): void {
    this.loadTasks();
  }

  /**
   * Loads tasks, timers, and notes data.
   * This method currently uses hardcoded data.
   */
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

  /**
   * Selects a task and filters related timers and notes.
   * @param task The task to select.
   */
  selectTask(task: TaskDto) {
    this.selectedTask = task;
    this.filteredTimers = this.timers.filter(timer => timer.taskId === task.id);
    this.filteredNotes = this.notes.filter(note => note.taskId === task.id);
    this.selectedTabIndex = 0; // Reset to the first tab
  }

  /**
   * Returns filtered timers for a given task ID.
   * @param taskId The ID of the task.
   * @returns An array of TimerDto related to the task.
   */
  getFilteredTimers(taskId: string) {
    return this.timers.filter(timer => timer.taskId === taskId);
  }

  /**
   * Returns filtered notes for a given task ID.
   * @param taskId The ID of the task.
   * @returns An array of NoteDto related to the task.
   */
  getFilteredNotes(taskId: string) {
    return this.notes.filter(note => note.taskId === taskId);
  }
}
