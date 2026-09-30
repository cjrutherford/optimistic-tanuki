import { CommonModule } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BugReportService } from '../bug-report.service';
import { LogBufferService } from '../log-buffer.service';

export type BugReportPosition =
  | 'above-chat'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

/**
 * Floating "Report a bug" button + minimal dialog.
 * Consumes BugReportService (nonce-secured, unauthenticated).
 */
@Component({
  selector: 'lib-bug-report-ui',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bug-report-ui.component.html',
  styleUrl: './bug-report-ui.component.scss',
})
export class BugReportUiComponent {
  /**
   * Corner placement. Defaults to `above-chat`: stacked above the persistent
   * bottom-right chat cluster so the button never covers existing UI.
   * Override per app if that corner collides with the app's own widgets.
   */
  readonly position = input<BugReportPosition>('above-chat');

  open = signal(false);
  description = signal('');
  sending = signal(false);
  result = signal<string | null>(null);
  error = signal<string | null>(null);

  constructor(
    private readonly reports: BugReportService,
    private readonly logs: LogBufferService
  ) {
    this.logs.start();
  }

  toggle(): void {
    this.open.update((v) => !v);
    this.result.set(null);
    this.error.set(null);
  }

  async submit(): Promise<void> {
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      const res = await this.reports.report(this.description());
      this.result.set(
        `Thanks — report ${res.id.slice(0, 8)} received.${
          res.issueUrl ? ' Tracked on GitHub.' : ''
        }`
      );
      this.description.set('');
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to send bug report'
      );
    } finally {
      this.sending.set(false);
    }
  }
}
