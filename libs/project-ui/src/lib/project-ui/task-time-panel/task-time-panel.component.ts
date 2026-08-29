import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TaskTimeEntry } from '@optimistic-tanuki/ui-models';
import {
  TimeTrackerComponent,
  formatDuration,
} from '../time-tracker/time-tracker.component';

/**
 * Where a person actually tracks their time.
 *
 * The tracker component existed and was rendered nowhere, so there was no
 * screen on which anybody could start a timer, and no screen showing the
 * totals. That is part of why every entry recording zero seconds went
 * unnoticed for so long: nothing displayed the number.
 *
 * Open tasks come first, because the reason to be here is to start working on
 * something. Finished tasks are kept, since their totals are the point of
 * having recorded anything.
 */

export interface TrackableTask {
  id: string;
  title: string;
  status?: string;
}

@Component({
  selector: 'lib-task-time-panel',
  standalone: true,
  imports: [CommonModule, TimeTrackerComponent],
  templateUrl: './task-time-panel.component.html',
  styleUrl: './task-time-panel.component.scss',
})
export class TaskTimePanelComponent {
  @Input() tasks: TrackableTask[] = [];
  @Input() entries: TaskTimeEntry[] = [];
  /** The task whose timer is mid-request, so its buttons can settle. */
  @Input() busyTaskId: string | null = null;
  @Output() startTimer = new EventEmitter<string>();
  @Output() stopTimer = new EventEmitter<string>();

  get ordered(): TrackableTask[] {
    const done = (task: TrackableTask) =>
      task.status === 'DONE' || task.status === 'ARCHIVED';
    return [...this.tasks].sort((a, b) => Number(done(a)) - Number(done(b)));
  }

  entriesFor(taskId: string): TaskTimeEntry[] {
    return this.entries.filter(
      (entry) => (entry.task?.id ?? entry.taskId) === taskId
    );
  }

  /** What the whole project has cost, so far as anything was recorded. */
  get total(): string {
    return formatDuration(
      this.entries.reduce((sum, entry) => sum + (entry.elapsedSeconds || 0), 0)
    );
  }

  get anyRunning(): boolean {
    return this.entries.some((entry) => !entry.endTime);
  }
}
