import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TaskTimeEntry } from '@optimistic-tanuki/ui-models';

/**
 * Time tracker component for starting/stopping time entries
 */
@Component({
  selector: 'lib-time-tracker',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './time-tracker.component.html',
  styleUrls: ['./time-tracker.component.scss'],
})
export class TimeTrackerComponent implements OnInit, OnDestroy {
  @Input() taskId!: string;
  @Input() timeEntries: TaskTimeEntry[] = [];
  @Output() startTimer = new EventEmitter<string>();
  @Output() stopTimer = new EventEmitter<string>();

  activeEntry: TaskTimeEntry | null = null;
  displayTime = '00:00:00';
  private intervalId: any;

  ngOnInit() {
    // Find if there's an active time entry (no endTime)
    this.activeEntry =
      this.timeEntries.find((entry) => !entry.endTime) || null;

    if (this.activeEntry) {
      this.startDisplayTimer();
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  onStartTimer() {
    this.startTimer.emit(this.taskId);
  }

  onStopTimer() {
    if (this.activeEntry) {
      this.stopTimer.emit(this.activeEntry.id);
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    }
  }

  private startDisplayTimer() {
    if (!this.activeEntry) return;

    this.intervalId = setInterval(() => {
      if (!this.activeEntry) return;

      const now = new Date();
      const start = new Date(this.activeEntry.startTime);
      const elapsedMs = now.getTime() - start.getTime();
      const totalSeconds = Math.floor(elapsedMs / 1000);

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      this.displayTime = `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
    }, 1000);
  }

  private pad(num: number): string {
    return num.toString().padStart(2, '0');
  }

  getTotalTimeFormatted(): string {
    const totalSeconds = this.timeEntries.reduce(
      (sum, entry) => sum + (entry.elapsedSeconds || 0),
      0
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${totalSeconds}s`;
    }
  }

  get isRunning(): boolean {
    return this.activeEntry !== null;
  }
}
