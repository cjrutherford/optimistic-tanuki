import { Component } from '@angular/core';

import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { TileComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { ContactService } from '../../app/contact.service';

@Component({
  selector: 'app-contact',
  providers: [ContactService],
  imports: [ContactFormComponent, TileComponent, HeadingComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  constructor(private contactService: ContactService) {}

  subjects = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Support' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'other', label: 'Other' },
  ];

  onContactFormSubmit($event: {name: string, email: string, subject: string, message: string}) {
    console.log('Contact form submission event:', $event);
    // Handle form submission logic here
    console.log('Contact form submitted', $event);
    this.contactService.postContact($event).subscribe({
      next: (response) => {
        console.log('Form submission successful', response);
      },
      error: (error) => {
        console.error('Form submission error', error);
      }
    });
  }
}
