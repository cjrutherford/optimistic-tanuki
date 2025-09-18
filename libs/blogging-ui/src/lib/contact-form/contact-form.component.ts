import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'lib-contact-form',
  imports: [
    CommonModule,
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
  @Output() submit = new EventEmitter<{name: string, email: string, subject: string, message: string}>();
  contactForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: [''],
      email: [''],
      subject: [''],
      message: [''],
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

  onSubscribe() {
    this.submit.emit(this.contactForm.value);
  }

  onClose() {
    // Handle close
  }
}
