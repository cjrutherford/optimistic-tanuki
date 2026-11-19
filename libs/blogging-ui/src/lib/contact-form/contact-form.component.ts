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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

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
    ReactiveFormsModule,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
})
export class ContactFormComponent {
  @Input() title = 'Reach out!';
  @Input() buttonText = 'Subscribe';
  @Input() set subjects(subjects: { value: string; label: string }[]) {
    this._subjects = subjects;
    this.applyInitialSubject();
  }
  get subjects(): { value: string; label: string }[] {
    return this._subjects;
  }
  @Input() subjectId = 'contact-subject';
  @Input() subjectLabel = 'Subject';
  /**
   * Image shown beside the form. No image by default; each app supplies its
   * own (previously a random external stock photo).
   */
  @Input() bannerImage: string | null = null;
  /** Alt text for the banner; empty marks it as decorative. */
  @Input() bannerAlt = '';
  @Input() set initialMessage(message: string | null) {
    if (typeof message === 'string' && message) {
      this.contactForm.patchValue({ message });
    }
  }
  /**
   * Preselects a subject. Ignored unless it matches the value of one of the
   * provided subjects, so an unknown value leaves the form as it was.
   */
  @Input() set initialSubject(subject: string | null | undefined) {
    this._initialSubject = subject ?? null;
    this.applyInitialSubject();
  }
  @Output() formSubmit = new EventEmitter<{
    name: string;
    email: string;
    subject: string;
    message: string;
  }>();
  contactForm: FormGroup;
  private _subjects: { value: string; label: string }[] = [];
  private _initialSubject: string | null = null;
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

  /** Bound to the subject select so a preselected subject is visible and editable. */
  get subjectControl(): FormControl<string> {
    return this.contactForm.get('subject') as FormControl<string>;
  }

  private applyInitialSubject(): void {
    const subject = this._initialSubject;
    if (
      subject &&
      this._subjects.some((option) => option.value === subject) &&
      !this.contactForm?.value.subject
    ) {
      this.contactForm.patchValue({ subject });
    }
  }

  onNameChange(name: string) {
    this.contactForm.patchValue({ name });
  }

  onEmailChange(email: string) {
    this.contactForm.patchValue({ email });
  }

  /** Bound to the message box so a prefilled message is visible and editable. */
  get messageControl(): FormControl<string> {
    return this.contactForm.get('message') as FormControl<string>;
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
