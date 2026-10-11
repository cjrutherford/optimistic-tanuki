import { Injectable, inject, signal } from '@angular/core';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';
import { AnalyticsService } from './analytics.service';
import {
  AssessmentAnswers,
  buildAssessmentMessage,
} from '../content/assessment';

export type AssessmentState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * Sends a private-cloud assessment through the public contact intake, the
 * same path the contact form uses.
 *
 * Provided by each assessment form rather than the root injector, so its
 * state lives as long as the form: coming back to the page after a
 * successful submission shows a fresh form, not the old thank-you.
 */
@Injectable()
export class AssessmentRequestService {
  private readonly blogging = inject(OptomisitcTanukiAPIService);
  private readonly analytics = inject(AnalyticsService);

  readonly state = signal<AssessmentState>('idle');

  submit(answers: AssessmentAnswers, honeypot: string): void {
    if (this.state() === 'sending') {
      return;
    }
    this.state.set('sending');

    this.blogging
      .contactControllerCreateContact({
        name: answers.name.trim(),
        email: answers.email.trim(),
        ...(answers.phone.trim() ? { phone: answers.phone.trim() } : {}),
        ...(answers.audience === 'organization' && answers.organization.trim()
          ? { company: answers.organization.trim() }
          : {}),
        subject: `Private cloud assessment (${
          answers.audience === 'home' ? 'home' : 'organization'
        })`,
        message: buildAssessmentMessage(answers),
        appScope: 'hai',
        sourcePage: `/private-cloud/assessment${this.analytics.campaignQuery()}`,
        sourceLabel: 'HAI private cloud assessment',
        // Hidden field; people leave it empty and the server ignores
        // submissions that fill it.
        website: honeypot,
      })
      .subscribe({
        next: () => {
          this.state.set('sent');
          this.analytics.trackOnce('assessment_submit', answers.audience);
        },
        error: () => this.state.set('failed'),
      });
  }
}
