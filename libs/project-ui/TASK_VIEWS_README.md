# Task Management Views

This directory contains advanced task management components for the Forge of Will project.

## Components

### Task Calendar Component

**Location:** `task-calendar/task-calendar.component.ts`

A FullCalendar-based calendar view for tasks with the following features:

- **Color Coding**: Tasks are color-coded by status (TODO, IN_PROGRESS, DONE, ARCHIVED)
- **Priority Highlighting**: High-priority tasks have bold borders
- **Multiple Views**: Supports day, week, month, and list views
- **Event Creation**: Click on a date to create a new task
- **Event Editing**: Click on a task to edit its details
- **All-Day Events**: Tasks without specific due dates are shown as all-day events

#### Usage

```typescript
<lib-task-calendar
  [tasks]="tasks"
  [loading]="loading"
  (createTask)="onCreateTask($event)"
  (editTask)="onEditTask($event)"
  (deleteTask)="onDeleteTask($event)"
  (dateSelected)="onDateSelected($event)"
></lib-task-calendar>
```

#### Color Scheme

- **Green (#28a745)**: Completed tasks
- **Blue (#007bff)**: In progress tasks
- **Gray (#6c757d)**: Archived tasks
- **Red (#dc3545)**: High priority TODO tasks
- **Orange (#fd7e14)**: Medium-high priority tasks
- **Yellow (#ffc107)**: Medium priority tasks
- **Teal (#17a2b8)**: Low priority tasks

---

### Task Kanban Component

**Location:** `task-kanban/task-kanban.component.ts`

A drag-and-drop kanban board for managing tasks with the following features:

- **Four Columns**: TODO, In Progress, Done, Archived
- **Drag & Drop**: Drag tasks between columns to change status
- **Task Count Badges**: Shows number of tasks per column
- **Priority Indicators**: Visual badges showing task priority
- **Inline Creation**: Add button in each column header
- **Due Date Display**: Shows formatted due dates

#### Usage

```typescript
<lib-task-kanban
  [tasks]="tasks"
  [loading]="loading"
  (createTask)="onCreateTask($event)"
  (editTask)="onEditTask($event)"
  (deleteTask)="onDeleteTask($event)"
  (statusChanged)="onStatusChanged($event)"
></lib-task-kanban>
```

#### Features

- **Reordering**: Drag tasks within the same column to reorder
- **Status Change**: Drag tasks to different columns to update status
- **Priority Classes**: Each task card is color-coded by priority
- **Empty State**: Shows helpful message when column is empty

---

### Mind Map Component

**Location:** `mind-map/mind-map.component.ts`

A canvas-based mind map visualization for project entities with the following features:

- **Multiple Entity Types**: Displays tasks, risks, and changes
- **Interactive Nodes**: Click nodes to select and view details
- **Draggable Nodes**: Drag nodes to rearrange the map
- **Zoom & Pan**: Mouse wheel to zoom, drag canvas to pan
- **Export**: Export the mind map as a PNG image
- **Color Coding**: Entities color-coded by type and status

#### Usage

```typescript
<lib-mind-map
  [tasks]="tasks"
  [risks]="risks"
  [changes]="changes"
  [projectId]="projectId"
  (nodeClick)="onNodeClick($event)"
  (nodeMove)="onNodeMove($event)"
></lib-mind-map>
```

#### Node Colors

**Tasks:**

- **Light Blue (#93c5fd)**: TODO
- **Yellow (#fbbf24)**: In Progress
- **Green (#86efac)**: Done
- **Gray (#d1d5db)**: Archived

**Risks:**

- **Red (#fca5a5)**: High impact
- **Orange (#fed7aa)**: Medium impact
- **Blue (#bfdbfe)**: Low impact

**Changes:**

- **Green (#86efac)**: Complete
- **Yellow (#fbbf24)**: Implementing
- **Purple (#c4b5fd)**: Pending approval
- **Gray (#d1d5db)**: Discarded

#### Controls

- **Left Click + Drag**: Move nodes
- **Mouse Wheel**: Zoom in/out
- **Reset View Button**: Reset zoom and pan
- **Export Button**: Download as PNG

---

## Integration Example

Here's how to integrate all three views with a view selector:

```typescript
// Component
taskViewMode = signal<'list' | 'calendar' | 'kanban'>('list');

setTaskViewMode(mode: 'list' | 'calendar' | 'kanban'): void {
  this.taskViewMode.set(mode);
}

// Template
<div class="view-selector">
  <button (click)="setTaskViewMode('list')">List View</button>
  <button (click)="setTaskViewMode('calendar')">Calendar View</button>
  <button (click)="setTaskViewMode('kanban')">Kanban View</button>
</div>

@if (taskViewMode() === 'list') {
  <lib-ag-tasks-table [tasks]="tasks"></lib-ag-tasks-table>
} @else if (taskViewMode() === 'calendar') {
  <lib-task-calendar [tasks]="tasks"></lib-task-calendar>
} @else if (taskViewMode() === 'kanban') {
  <lib-task-kanban [tasks]="tasks"></lib-task-kanban>
}
```

## Dependencies

- **FullCalendar**: v6.x

  - @fullcalendar/core
  - @fullcalendar/angular
  - @fullcalendar/daygrid
  - @fullcalendar/timegrid
  - @fullcalendar/interaction
  - @fullcalendar/list

- **Angular CDK**: For drag-and-drop in kanban board

  - @angular/cdk/drag-drop

- **HTML5 Canvas**: For mind map rendering (native browser API)

## Browser Support

All components are compatible with modern browsers that support:

- ES2020+
- HTML5 Canvas API
- CSS Grid and Flexbox
- Drag and Drop API

## Testing

Unit tests are provided for each component:

- `task-calendar.component.spec.ts`
- `task-kanban.component.spec.ts`
- `mind-map.component.spec.ts`

Note: Mind map tests may show canvas warnings in JSDOM environment, which is expected behavior.

## Styling

Components use CSS custom properties for theming:

- `--accent`: Primary accent color
- `--accent-dark`: Darker accent color for hover states
- `--background`: Background color
- `--background-secondary`: Secondary background color
- `--border-color`: Border color for UI elements
- `--foreground-color`: Text color

## Performance Considerations

- **Calendar**: Handles up to 1000 events efficiently
- **Kanban**: Optimized drag-and-drop with virtual scrolling support
- **Mind Map**: Canvas rendering is performant for up to 100 nodes

## Accessibility

- All components support keyboard navigation
- ARIA labels provided for interactive elements
- Color schemes maintain WCAG AA contrast ratios
- Screen reader friendly announcements for drag-and-drop operations
