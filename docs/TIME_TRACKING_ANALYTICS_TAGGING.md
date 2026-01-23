# Task Time Tracking, Analytics, and Tagging

This document describes the time tracking, analytics, and tagging features for the project management service.

## Overview

The project management system now supports:
- **Time Tracking**: Track time spent on tasks with multiple time entries
- **Task Tagging**: Organize and filter tasks using tags
- **Analytics**: Generate reports on time spent by task, project, or tag

## Features

### Time Tracking

#### TaskTimeEntry Entity
Represents a single time tracking session for a task.

**Fields:**
- `id`: Unique identifier
- `taskId`: Associated task
- `startTime`: When the timer started
- `endTime`: When the timer stopped (nullable for running timers)
- `elapsedSeconds`: Total elapsed time in seconds
- `description`: Optional description of what was done
- `createdBy`: User who started the timer

**Workflow:**
1. Start a timer: Creates a new TaskTimeEntry with current startTime
2. Stop the timer: Updates the entry with endTime and calculates elapsedSeconds
3. View history: All time entries are preserved for audit and analytics

#### API Endpoints
- `POST /task-time-entry` - Start a new time entry
- `PATCH /task-time-entry/:id/stop` - Stop an active time entry
- `GET /task-time-entry?taskId=xxx` - Get all time entries for a task
- `DELETE /task-time-entry/:id` - Soft-delete a time entry

### Task Tagging

#### TaskTag Entity
Represents a reusable tag that can be applied to multiple tasks.

**Fields:**
- `id`: Unique identifier
- `name`: Tag name (unique)
- `color`: Optional hex color for display
- `description`: Optional tag description

**Many-to-Many Relationship:**
Tasks can have multiple tags, and tags can be applied to multiple tasks.

#### API Endpoints
- `POST /task-tag` - Create a new tag
- `GET /task-tag` - List all tags
- `GET /task-tag/:id` - Get a specific tag
- `PATCH /task-tag/:id` - Update a tag
- `DELETE /task-tag/:id` - Soft-delete a tag

#### Using Tags
When creating or updating a task, include `tagIds` in the request:

```typescript
{
  title: "Implement login",
  description: "Add OAuth login",
  tagIds: ["frontend-tag-id", "high-priority-tag-id"]
}
```

### Analytics

#### Analytics Service
Provides aggregated time tracking data with flexible filtering.

**Available Analytics:**

1. **Task Analytics** - Time breakdown by individual tasks
   - Total time per task
   - Number of time entries
   - Associated tags

2. **Project Analytics** - Overall project time metrics
   - Total project time
   - Task count
   - Per-task breakdown

3. **Tag Analytics** - Time spent on tasks with specific tags
   - Total time per tag
   - Number of tasks with the tag
   - Useful for tracking time by category (e.g., "frontend", "bugfix")

#### API Endpoints
- `POST /analytics/task` - Get task analytics
- `POST /analytics/project` - Get project analytics
- `POST /analytics/tag` - Get tag analytics

#### Query Filters
All analytics endpoints support:
- `projectId`: Filter by project
- `taskIds`: Filter by specific tasks
- `tagIds`: Filter by tags
- `startDate`/`endDate`: Time range filter
- `userId`: Filter by user who tracked the time

**Example Query:**
```typescript
{
  projectId: "project-123",
  tagIds: ["frontend-tag-id"],
  startDate: "2024-01-01",
  endDate: "2024-01-31"
}
```

Returns: Time spent on frontend tasks in the specified project during January.

## UI Components

### TagSelectorComponent
A reusable component for selecting multiple tags.

**Usage:**
```typescript
<lib-tag-selector
  [availableTags]="allTags"
  [selectedTagIds]="task.tagIds"
  (selectionChange)="onTagsChanged($event)"
></lib-tag-selector>
```

### TimeTrackerComponent
Displays current timer and total time with start/stop controls.

**Usage:**
```typescript
<lib-time-tracker
  [taskId]="task.id"
  [timeEntries]="task.timeEntries"
  (startTimer)="onStartTimer($event)"
  (stopTimer)="onStopTimer($event)"
></lib-time-tracker>
```

**Features:**
- Real-time countdown display
- Total time aggregation
- Automatic detection of active timers
- Start/Stop button state management

### AG Grid Task Table
The task table now includes:
- **Tags Column**: Displays colored tag badges
- **Time Spent Column**: Shows total time in human-readable format (e.g., "2h 30m")

## Database Schema

### New Tables
- `task_time_entry`: Stores individual time tracking sessions
- `task_tag`: Stores reusable tags
- `task_tags`: Junction table for Task <-> TaskTag many-to-many relationship

### Updated Tables
- `task`: Added relationships to `timeEntries` and `tags`

## Migration Notes

When deploying this feature:
1. Run database migrations to create new tables
2. Existing tasks will have empty `timeEntries` and `tags` arrays
3. No data migration is needed - the feature is additive

## Best Practices

### Time Tracking
- Start timers when beginning work on a task
- Stop timers when taking breaks or switching tasks
- Use descriptions to note what was accomplished
- Review time entries before marking tasks as complete

### Tagging
- Create a consistent set of tags (e.g., "frontend", "backend", "bugfix")
- Use colors to make tags visually distinct
- Apply multiple tags to tasks for better filtering
- Avoid creating duplicate or very similar tags

### Analytics
- Use date ranges to analyze sprint or monthly productivity
- Filter by tags to understand time distribution across work types
- Compare project analytics to identify time-intensive areas
- Use analytics to improve estimates for future tasks

## Examples

### Starting a Timer
```typescript
// Backend
await taskTimeEntryService.create({
  taskId: 'task-123',
  createdBy: 'user-456',
  description: 'Implementing feature'
});

// Frontend
this.timeTracker.onStartTimer();
```

### Filtering Tasks by Tag
```typescript
// Query tasks with specific tags
await taskService.findAll({
  projectId: 'project-123',
  tagIds: ['frontend-tag', 'high-priority-tag']
});
```

### Getting Project Time Report
```typescript
const analytics = await analyticsService.getProjectAnalytics({
  projectId: 'project-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

console.log(`Total time: ${analytics.totalTimeSeconds / 3600} hours`);
console.log(`Tasks completed: ${analytics.taskCount}`);
```

## Future Enhancements

Potential improvements for future versions:
- Time entry editing/correction
- Bulk tag operations
- Custom analytics reports
- Time entry approval workflow
- Scheduled analytics reports
- Tag hierarchies/categories
- Time budget alerts
- Integration with calendar/scheduling tools
