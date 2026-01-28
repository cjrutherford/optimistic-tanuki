# Component Integration Guide

This guide demonstrates how to integrate the new time tracking, tagging, and analytics components into your application.

## 1. Task Form with Tag Selection

The TaskFormComponent now supports tag selection through the TagSelectorComponent.

### Usage Example

```typescript
// In your component
import { Component } from '@angular/core';
import { TaskFormComponent } from '@optimistic-tanuki/project-ui';
import { Task, TaskTag } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-task-manager',
  template: `
    <lib-task-form
      [task]="selectedTask"
      [availableTags]="availableTags"
      (formSubmit)="onTaskSubmit($event)"
    ></lib-task-form>
  `
})
export class TaskManagerComponent {
  selectedTask: Task | null = null;
  availableTags: TaskTag[] = [
    { id: '1', name: 'Frontend', color: '#3498db', createdBy: 'user1', createdAt: new Date() },
    { id: '2', name: 'Backend', color: '#2ecc71', createdBy: 'user1', createdAt: new Date() },
    { id: '3', name: 'Bug Fix', color: '#e74c3c', createdBy: 'user1', createdAt: new Date() },
  ];

  onTaskSubmit(task: Task) {
    console.log('Task submitted with tags:', task.tags);
    // Submit to backend
  }
}
```

### Visual Features
- Multi-select tag interface with colored badges
- Click to toggle selection
- Selected tags highlighted with background color
- Tags persist through edit operations

## 2. AG Grid Task Table with Timer Controls

The AgTasksTableComponent now includes inline timer controls in the Actions column.

### Usage Example

```typescript
// In your component
import { Component } from '@angular/core';
import { AgTasksTableComponent } from '@optimistic-tanuki/project-ui';
import { Task, CreateTask } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-tasks-view',
  template: `
    <lib-ag-tasks-table
      [tasks]="tasks"
      [loading]="loading"
      (createTask)="onCreate($event)"
      (editTask)="onEdit($event)"
      (deleteTask)="onDelete($event)"
      (startTimer)="onStartTimer($event)"
      (stopTimer)="onStopTimer($event)"
    ></lib-ag-tasks-table>
  `
})
export class TasksViewComponent {
  tasks: Task[] = [];
  loading = false;

  onStartTimer(taskId: string) {
    console.log('Starting timer for task:', taskId);
    // Call backend to create TaskTimeEntry
    this.taskService.startTimer(taskId).subscribe(() => {
      // Refresh tasks to update timer state
      this.loadTasks();
    });
  }

  onStopTimer(timeEntryId: string) {
    console.log('Stopping timer for entry:', timeEntryId);
    // Call backend to update TaskTimeEntry with endTime
    this.taskService.stopTimer(timeEntryId).subscribe(() => {
      // Refresh tasks to update timer state
      this.loadTasks();
    });
  }
}
```

### Timer Button Behavior
- **Green "▶ Start" button**: Shown when no active timer
- **Red "⏸ Stop" button**: Shown when timer is running
- Auto-detects timer state from `task.timeEntries`
- Automatically updates based on task data changes

## 3. Analytics Dashboard

The AnalyticsDashboardComponent displays comprehensive time tracking analytics.

### Usage Example

```typescript
// In your component
import { Component, OnInit } from '@angular/core';
import { AnalyticsDashboardComponent } from '@optimistic-tanuki/project-ui';
import { ProjectAnalytics, TagAnalytics } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-analytics',
  template: `
    <lib-analytics-dashboard
      [projectAnalytics]="projectAnalytics"
      [tagAnalytics]="tagAnalytics"
    ></lib-analytics-dashboard>
  `
})
export class AnalyticsComponent implements OnInit {
  projectAnalytics: ProjectAnalytics | null = null;
  tagAnalytics: TagAnalytics[] = [];

  ngOnInit() {
    this.loadAnalytics();
  }

  loadAnalytics() {
    // Fetch project analytics from backend
    this.analyticsService.getProjectAnalytics({
      projectId: this.projectId,
      startDate: this.startDate,
      endDate: this.endDate
    }).subscribe(data => {
      this.projectAnalytics = data;
    });

    // Fetch tag analytics from backend
    this.analyticsService.getTagAnalytics({
      projectId: this.projectId
    }).subscribe(data => {
      this.tagAnalytics = data;
    });
  }
}
```

### Dashboard Features

**Project Summary Card:**
- Total time spent (formatted as hours and minutes)
- Total task count
- Number of unique tags used

**Top Tasks by Time:**
- Lists top 5 tasks by time spent
- Visual progress bars showing relative time
- Displays number of time entries per task
- Shows associated tags for each task

**Top Tags by Time:**
- Lists top 5 tags by time spent
- Visual progress bars showing relative time distribution
- Shows number of tasks per tag

**Empty State:**
- Displays helpful message when no data available
- Encourages users to start tracking time

## 4. Time Tracker Component (Standalone)

The TimeTrackerComponent can be used independently for task detail views.

### Usage Example

```typescript
// In your component
import { Component } from '@angular/core';
import { TimeTrackerComponent } from '@optimistic-tanuki/project-ui';
import { Task, TaskTimeEntry } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-task-detail',
  template: `
    <div class="task-detail">
      <h2>{{ task.title }}</h2>
      
      <lib-time-tracker
        [taskId]="task.id"
        [timeEntries]="task.timeEntries || []"
        (startTimer)="onStartTimer($event)"
        (stopTimer)="onStopTimer($event)"
      ></lib-time-tracker>
      
      <h3>Time Entries</h3>
      <ul>
        <li *ngFor="let entry of task.timeEntries">
          {{ entry.startTime | date:'short' }} - 
          {{ entry.endTime ? (entry.endTime | date:'short') : 'Running' }}
          ({{ formatSeconds(entry.elapsedSeconds) }})
        </li>
      </ul>
    </div>
  `
})
export class TaskDetailComponent {
  task: Task;

  onStartTimer(taskId: string) {
    // Start new time entry
  }

  onStopTimer(entryId: string) {
    // Stop active time entry
  }

  formatSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
}
```

### Time Tracker Features
- Real-time countdown when timer is running
- Total time aggregation across all entries
- Automatic detection of active timers
- Clean start/stop button interface
- Displays both current session and total time

## Backend Integration

### Starting a Timer

```typescript
// Backend call
POST /task-time-entry
{
  "taskId": "task-uuid",
  "createdBy": "user-uuid",
  "description": "Working on feature X"
}

// Response
{
  "id": "entry-uuid",
  "taskId": "task-uuid",
  "startTime": "2024-01-23T10:00:00Z",
  "endTime": null,
  "elapsedSeconds": 0,
  "createdBy": "user-uuid"
}
```

### Stopping a Timer

```typescript
// Backend call
PATCH /task-time-entry/{entryId}/stop
{
  "updatedBy": "user-uuid"
}

// Response
{
  "id": "entry-uuid",
  "taskId": "task-uuid",
  "startTime": "2024-01-23T10:00:00Z",
  "endTime": "2024-01-23T12:30:00Z",
  "elapsedSeconds": 9000, // 2.5 hours
  "createdBy": "user-uuid"
}
```

### Creating a Task with Tags

```typescript
// Backend call
POST /task
{
  "title": "Implement login",
  "description": "Add OAuth login flow",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "projectId": "project-uuid",
  "createdBy": "user-uuid",
  "tagIds": ["frontend-tag-id", "security-tag-id"]
}
```

### Getting Analytics

```typescript
// Get project analytics
POST /analytics/project
{
  "projectId": "project-uuid",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}

// Response
{
  "projectId": "project-uuid",
  "projectName": "My Project",
  "totalTimeSeconds": 144000,
  "taskCount": 12,
  "tasks": [
    {
      "taskId": "task-1",
      "taskTitle": "Feature A",
      "totalTimeSeconds": 36000,
      "entryCount": 5,
      "tags": ["frontend", "ui"]
    }
  ]
}

// Get tag analytics
POST /analytics/tag
{
  "projectId": "project-uuid"
}

// Response
[
  {
    "tagId": "tag-1",
    "tagName": "frontend",
    "totalTimeSeconds": 72000,
    "taskCount": 8
  }
]
```

## Styling Notes

All components use CSS custom properties for theming:

```css
--primary: #3498db
--accent: #9b59b6
--success: #2ecc71
--danger: #e74c3c
--warning: #f39c12
--text-primary: #333
--text-secondary: #666
--surface-color: #f9f9f9
--border-color: #e0e0e0
```

Components are designed to work with your existing theme and will adapt to CSS variable overrides.

## Complete Example: Project Dashboard

Here's a complete example combining all components:

```typescript
@Component({
  selector: 'app-project-dashboard',
  template: `
    <div class="project-dashboard">
      <!-- Analytics at the top -->
      <section class="analytics-section">
        <lib-analytics-dashboard
          [projectAnalytics]="analytics"
          [tagAnalytics]="tagAnalytics"
        ></lib-analytics-dashboard>
      </section>

      <!-- Task management below -->
      <section class="tasks-section">
        <lib-ag-tasks-table
          [tasks]="tasks"
          (createTask)="onCreate($event)"
          (editTask)="onEdit($event)"
          (deleteTask)="onDelete($event)"
          (startTimer)="onStartTimer($event)"
          (stopTimer)="onStopTimer($event)"
        ></lib-ag-tasks-table>
      </section>

      <!-- Task form modal -->
      <div *ngIf="showTaskForm" class="modal">
        <lib-task-form
          [task]="selectedTask"
          [availableTags]="availableTags"
          (formSubmit)="onTaskSubmit($event)"
        ></lib-task-form>
      </div>
    </div>
  `,
  styles: [`
    .project-dashboard {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 24px;
    }

    .analytics-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .tasks-section {
      flex: 1;
    }
  `]
})
export class ProjectDashboardComponent implements OnInit {
  tasks: Task[] = [];
  analytics: ProjectAnalytics | null = null;
  tagAnalytics: TagAnalytics[] = [];
  availableTags: TaskTag[] = [];
  selectedTask: Task | null = null;
  showTaskForm = false;

  ngOnInit() {
    this.loadProject();
  }

  loadProject() {
    // Load all data
    this.loadTasks();
    this.loadAnalytics();
    this.loadTags();
  }

  // ... implementation methods
}
```

This provides a complete, production-ready project management interface with time tracking, tagging, and analytics.
