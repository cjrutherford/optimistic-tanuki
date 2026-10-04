import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type ContributionView,
  problem,
} from '@optimistic-tanuki/civic-briefing-data-access';
import {
  longDate,
  ReviewTrailComponent,
} from '@optimistic-tanuki/civic-briefing-ui';

/** The signed-in contributor's Daylight reports, each with its state and reasons, and the actions open to them. */
@Component({
  selector: 'app-daylight-my-reports',
  imports: [ReactiveFormsModule, RouterLink, ReviewTrailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-my-reports.component.html',
  styleUrl: './daylight-account.scss',
})
export class DaylightMyReportsComponent {
  private readonly civic = inject(CivicAPIService);
  private readonly fb = inject(FormBuilder);
  protected readonly longDate = longDate;
  protected readonly reports = signal<ContributionView[]>([]);
  protected readonly failure = signal('');
  protected readonly message = signal('');
  protected readonly countering = signal<string | null>(null);
  protected readonly counter = this.fb.nonNullable.group({
    noticeId: ['', Validators.required],
    statement: ['', [Validators.required, Validators.minLength(10)]],
    underPenalty: false,
    consentToJurisdiction: false,
    signature: ['', Validators.required],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.civic.mine().subscribe({
      next: (reply) => this.reports.set(reply.data),
      error: (error: unknown) =>
        this.failure.set(problem(error, 'Your reports could not be loaded.')),
    });
  }

  protected withdraw(report: ContributionView): void {
    this.civic.withdraw(report.id).subscribe({
      next: () => {
        this.message.set('Withdrawn.');
        this.load();
      },
      error: (error: unknown) => this.message.set(problem(error)),
    });
  }

  protected sendCounter(report: ContributionView): void {
    this.civic.counterNotice(report.id, this.counter.getRawValue()).subscribe({
      next: () => {
        this.countering.set(null);
        this.message.set(
          'Counter-notice sent. The operator decides whether to restore the report, and you will see it here.'
        );
      },
      error: (error: unknown) => this.message.set(problem(error)),
    });
  }
}
