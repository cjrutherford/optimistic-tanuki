import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { TileComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-contact',
  imports: [CommonModule, ContactFormComponent, TileComponent, HeadingComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  subjects = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Support' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'other', label: 'Other' },
  ];

  onContactFormSubmit() {
    // Handle form submission logic here
    console.log('Contact form submitted');
  }
}
