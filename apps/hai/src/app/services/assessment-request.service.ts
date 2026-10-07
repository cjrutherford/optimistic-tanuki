import { Injectable, inject, signal } from '@angular/core';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';
import {
  AssessmentAnswers,
  buildAssessmentMessage,
} from '../content/assessment';

export type AssessmentState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * Sends a private-cloud assessment through the public contact intake, the
 * same path the contact form uses.
 */
@Injectable({ providedIn: 'root' })
export class AssessmentRequestService {
  private readonly blogging = inject(OptomisitcTanukiAPIService);

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
        sourcePage: '/private-cloud/assessment',
        sourceLabel: 'HAI private cloud assessment',
        // Hidden field; people leave it empty and the server ignores
        // submissions that fill it.
        website: honeypot,
      })
      .subscribe({
        next: () => this.state.set('sent'),
        error: () => this.state.set('failed'),
      });
  }
}
