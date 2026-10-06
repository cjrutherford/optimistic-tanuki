import { Injectable, inject, signal } from '@angular/core';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const CONTACT_RECEIVED_MESSAGE =
  'Message received. A platform owner will personally acknowledge it within one business hour, Monday–Friday, 9 a.m.–5 p.m. Eastern.';

export const CONTACT_FAILED_MESSAGE =
  'Unable to submit the message right now. Please try again shortly.';

/**
 * Sends contact-form submissions and carries a prefilled message between
 * pages, e.g. from the cost comparison to the contact page.
 */
@Injectable({ providedIn: 'root' })
export class ContactRequestService {
  private readonly blogging = inject(OptomisitcTanukiAPIService);

  readonly submitting = signal(false);
  readonly status = signal<string | null>(null);
  readonly prefill = signal<string | null>(null);

  setPrefill(message: string): void {
    this.prefill.set(message);
    this.status.set(null);
  }

  submit(request: ContactRequest, sourcePage: string): void {
    this.submitting.set(true);
    this.status.set(null);

    this.blogging
      .contactControllerCreateContact({
        ...request,
        appScope: 'hai',
        sourcePage,
        sourceLabel: 'HAI',
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.status.set(CONTACT_RECEIVED_MESSAGE);
        },
        error: () => {
          this.submitting.set(false);
          this.status.set(CONTACT_FAILED_MESSAGE);
        },
      });
  }
}
