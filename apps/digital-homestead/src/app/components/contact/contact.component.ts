import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { ContactService } from '../../contact.service';

@Component({
  selector: 'dh-contact',
  imports: [CommonModule, HeadingComponent, ButtonComponent, ReactiveFormsModule, ContactFormComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {

  constructor(private readonly contactService: ContactService) {}

  subjects = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Support' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'other', label: 'Other' },
  ];

  onContactFormSubmit($event: any) {
    this.contactService.postContact($event).subscribe({
      next: (response) => {
        console.log('Contact form submitted successfully', response);
      },
      error: (error) => {
        console.error('Error submitting contact form', error);
      }
    });
  }
}
