import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-contact',
  imports: [CommonModule, HeadingComponent, ButtonComponent, ReactiveFormsModule, ContactFormComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {

  onContactFormSubmit($event: any) {
    console.log('Contact form submitted:', $event);
  }
}
