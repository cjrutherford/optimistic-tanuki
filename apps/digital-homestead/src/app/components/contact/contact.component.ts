import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'dh-contact',
  imports: [CommonModule, HeadingComponent, ButtonComponent, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  contactForm!: FormGroup;

  constructor(private readonly formBuilder: FormBuilder) {}

  ngOnInit() {
    this.contactForm = this.formBuilder.group({
      name: [''],
      email: [''],
      message: ['']
    });
  }

  onSubmit() {
    if (this.contactForm.valid) {
      // Handle form submission
      console.log(this.contactForm.value);
    }
  }
}
