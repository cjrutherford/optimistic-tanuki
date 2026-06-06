import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'hai-contact-section',
  standalone: true,
  imports: [ContactFormComponent],
  templateUrl: './contact-section.component.html',
  styleUrl: './contact-section.component.scss',
})
export class ContactSectionComponent {
  @Input({ required: true })
  contactLead!: { title: string; description: string };

  @Input({ required: true })
  contactSubjects: Array<{ value: string; label: string }> = [];

  @Input() submittingContact = false;
  @Input() contactStatus: string | null = null;

  @Output() formSubmit = new EventEmitter<{
    name: string;
    email: string;
    subject: string;
    message: string;
  }>();
}
