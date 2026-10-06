import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  problem,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

/**
 * A copyright notice, for anyone who believes a Daylight contribution copies
 * their work. The fields are the elements DMCA §512(c)(3) requires, asked for
 * in plain words; an operator decides every notice. Ported from the Daylight
 * POC (plan slice P4.4).
 */
@Component({
  selector: 'app-daylight-copyright-page',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-copyright.page.html',
  styleUrl: './daylight-copyright.page.scss',
})
export class DaylightCopyrightPage {
  private readonly civic = inject(CivicAPIService);
  private readonly fb = inject(FormBuilder);
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly filed = signal<{ id: string } | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    claimantName: ['', Validators.required],
    claimantEmail: ['', [Validators.required, Validators.email]],
    claimantAddress: ['', Validators.required],
    work: ['', Validators.required],
    locations: ['', Validators.required],
    goodFaith: false,
    accurateUnderPenalty: false,
    signature: ['', Validators.required],
  });

  protected send(): void {
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set('');
    this.civic
      .fileNotice({
        ...value,
        locations: value.locations.split(/\s+/u).filter(Boolean),
      })
      .subscribe({
        next: (reply) => {
          this.pending.set(false);
          this.filed.set(reply.data);
        },
        error: (failure: unknown) => {
          this.pending.set(false);
          this.error.set(
            problem(
              failure,
              'The notice could not be sent. Try again in a moment.'
            )
          );
        },
      });
  }
}
