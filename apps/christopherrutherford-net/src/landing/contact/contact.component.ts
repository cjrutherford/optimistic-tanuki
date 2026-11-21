import { Component, inject, signal } from '@angular/core';

import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { SectionHeadingComponent } from '@optimistic-tanuki/common-ui';
import { ContactService } from '../../app/contact.service';
import { PROFILE } from '../profile.data';

export type ContactStatus = 'idle' | 'pending' | 'success' | 'error';

@Component({
  selector: 'app-contact',
  providers: [ContactService],
  imports: [ContactFormComponent, SectionHeadingComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  readonly profile = PROFILE;

  private contactService = inject(ContactService);

  readonly status = signal<ContactStatus>('idle');

  subjects = [
    'Employment opportunity',
    'Contract engineering',
    'Consulting project',
    'Collaboration / open source',
    'General inquiry',
  ].map((label) => ({ value: label, label }));

  onContactFormSubmit($event: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    if (this.status() === 'pending') {
      return;
    }
    this.status.set('pending');
    this.contactService.postContact($event).subscribe({
      next: () => this.status.set('success'),
      error: () => {
        // Deliberately generic: never log the payload or error body (PII).
        console.error('Contact form submission failed');
        this.status.set('error');
      },
    });
  }
}
