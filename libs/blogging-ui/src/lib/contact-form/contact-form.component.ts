import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import {
  ButtonComponent,
  CardComponent,
  HeadingComponent,
} from '@optimistic-tanuki/common-ui';
import {
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'lib-contact-form',
  imports: [
    CardComponent,
    TextInputComponent,
    SelectComponent,
    ButtonComponent,
    TextAreaComponent,
    HeadingComponent,
    SelectComponent,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
})
export class ContactFormComponent {
  @Input() title = 'Reach out!';
  @Input() buttonText = 'Subscribe';
  @Input() subjects: { value: string; label: string }[] = [];
  @Input() bannerImage = 'https://picsum.photos/1200/300';
  @Output() formSubmit = new EventEmitter<{
    name: string;
    email: string;
    subject: string;
    message: string;
  }>();
  contactForm: FormGroup;
  private fb = inject(FormBuilder);

  constructor() {
    this.contactForm = this.fb.group({
      name: [''],
      email: [''],
      subject: [''],
      message: [''],
      website: [''], // Honeypot
    });
  }

  onNameChange(name: string) {
    this.contactForm.patchValue({ name });
  }

  onEmailChange(email: string) {
    this.contactForm.patchValue({ email });
  }

  onMessageChange(message: string) {
    this.contactForm.patchValue({ message });
  }

  onSubjectChange(subject: Event) {
    const selectElement = subject.target as HTMLSelectElement;
    this.contactForm.patchValue({ subject: selectElement.value });
  }

  onHoneypotChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.contactForm.patchValue({ website: input.value });
  }

  onSubscribe() {
    if (this.contactForm.value.website) {
      console.log('Spam detected');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { website, ...formData } = this.contactForm.value;
    this.formSubmit.emit(formData);
  }

  onClose() {
    // Handle close
  }
}
