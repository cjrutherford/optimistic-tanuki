import { Component, inject } from '@angular/core';
import { ContactSectionComponent } from '../../components/landing/contact-section.component';
import { CONTACT_LEAD, CONTACT_SUBJECTS } from '../../content/site-content';
import {
  ContactRequest,
  ContactRequestService,
} from '../../services/contact-request.service';

@Component({
  selector: 'hai-contact-page',
  standalone: true,
  imports: [ContactSectionComponent],
  template: `
    <h1 class="visually-hidden">Contact</h1>
    <hai-contact-section
      [contactLead]="contactLead"
      [contactSubjects]="contactSubjects"
      [submittingContact]="contact.submitting()"
      [contactStatus]="contact.status()"
      [contactPrefill]="contact.prefill()"
      (formSubmit)="submit($event)"
    ></hai-contact-section>
  `,
})
export class ContactPageComponent {
  readonly contact = inject(ContactRequestService);
  readonly contactLead = CONTACT_LEAD;
  readonly contactSubjects = CONTACT_SUBJECTS;

  submit(request: ContactRequest): void {
    this.contact.submit(request, '/contact');
  }
}
