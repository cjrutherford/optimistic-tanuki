import {
  Component,
  Inject,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TaskTimeEntry } from '@optimistic-tanuki/ui-models';

/**
 * Start and stop the clock on one task, and see what it has cost so far.
 *
 * The running figure here is a display only. What is recorded is decided by
 * the server from its own clock, so a wrong clock on this machine makes the
 * number on screen drift and changes nothing that is stored.
 */
@Component({
  selector: 'lib-time-tracker',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './time-tracker.component.html',
  styleUrls: ['./time-tracker.component.scss'],
})
export class TimeTrackerComponent implements OnChanges, OnDestroy {
  @Input() taskId!: string;
  @Input() timeEntries: TaskTimeEntry[] = [];
  /** True between pressing a button and the answer coming back. */
  @Input() busy = false;
  @Output() startTimer = new EventEmitter<string>();
  @Output() stopTimer = new EventEmitter<string>();

  activeEntry: TaskTimeEntry | null = null;
  displayTime = '00:00:00';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Taken through the constructor with a default, rather than inject() in a
   * field initializer, so the component can still be constructed directly the
   * way the rest of this library's tests construct theirs.
   */
  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: string = 'browser'
  ) {}

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Reacts to the entries changing, not only to being created.
   *
   * This ran once in ngOnInit, so starting a timer left the component showing
   * the state it had at first render: the button stayed on "Start" and the
   * clock never moved until the page was rebuilt.
   */
  ngOnChanges(): void {
    this.activeEntry = this.timeEntries.find((entry) => !entry.endTime) ?? null;

    if (this.activeEntry) {
      this.tick();
      this.run();
    } else {
      this.halt();
      this.displayTime = '00:00:00';
    }
  }

  ngOnDestroy(): void {
    this.halt();
  }

  onStartTimer(): void {
    if (this.busy) return;
    this.startTimer.emit(this.taskId);
  }

  onStopTimer(): void {
    if (this.busy || !this.activeEntry) return;
    this.stopTimer.emit(this.activeEntry.id);
  }

  get isRunning(): boolean {
    return this.activeEntry !== null;
  }

  /** Everything recorded against this task, including what is running now. */
  getTotalTimeFormatted(): string {
    const recorded = this.timeEntries.reduce(
      (sum, entry) => sum + (entry.elapsedSeconds || 0),
      0
    );
    return formatDuration(recorded + this.runningSeconds());
  }

  private runningSeconds(): number {
    if (!this.activeEntry) return 0;
    const started = new Date(this.activeEntry.startTime).getTime();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  }

  private run(): void {
    // Nothing to animate on the server, and an interval there keeps the
    // application from ever going quiet.
    if (!this.isBrowser || this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private halt(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    // Straight away as well as every second, so a running timer does not show
    // 00:00:00 for its first second.
    this.displayTime = asClock(this.runningSeconds());
  }
}

function asClock(totalSeconds: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return [
    pad(Math.floor(totalSeconds / 3600)),
    pad(Math.floor((totalSeconds % 3600) / 60)),
    pad(totalSeconds % 60),
  ].join(':');
}

/** Readable rather than exact: nobody reads a timesheet in seconds. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'none yet';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}
