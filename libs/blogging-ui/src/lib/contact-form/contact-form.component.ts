import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
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
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
})
export class ContactFormComponent {
  @Input() subjects: string[] = [];
  @Input() bannerImage = 'https://picsum.photos/1200/300';
  @Output() submit = new EventEmitter<void>();
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

  onSubjectChange(subject: string) {
    this.contactForm.patchValue({ subject });
  }

  onSubscribe() {
    this.submit.emit();
  }

  onClose() {
    // Handle close
  }
}
