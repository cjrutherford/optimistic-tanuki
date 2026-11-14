import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
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
    <hai-contact-section
      [contactLead]="contactLead"
      [contactSubjects]="contactSubjects"
      [submittingContact]="contact.submitting()"
      [contactStatus]="contact.status()"
      [contactPrefill]="contact.prefill()"
      [initialSubject]="initialSubject()"
      (formSubmit)="submit($event)"
    ></hai-contact-section>
  `,
})
export class ContactPageComponent {
  readonly contact = inject(ContactRequestService);
  readonly contactLead = CONTACT_LEAD;
  readonly contactSubjects = CONTACT_SUBJECTS;

  private readonly queryParams = toSignal(
    inject(ActivatedRoute).queryParamMap,
    { requireSync: false }
  );

  /** The `?subject=` value when it names a known subject, otherwise null. */
  readonly initialSubject = computed(() => {
    const subject = this.queryParams()?.get('subject');
    return subject &&
      this.contactSubjects.some((option) => option.value === subject)
      ? subject
      : null;
  });

  submit(request: ContactRequest): void {
    this.contact.submit(request, '/contact');
  }
}
