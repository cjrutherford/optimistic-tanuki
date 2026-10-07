import {
  Component,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ASSESSMENT_KEEP,
  ASSESSMENT_PEOPLE,
  ASSESSMENT_STORAGE,
  AssessmentAnswers,
  AssessmentAudience,
} from '../../content/assessment';
import { CONTACT_DETAILS } from '../../content/contact-details';
import { AssessmentRequestService } from '../../services/assessment-request.service';
import { AnalyticsService } from '../../services/analytics.service';

interface FieldError {
  id: string;
  message: string;
}

/** The private-cloud assessment form, with success and failure states. */
@Component({
  selector: 'hai-assessment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './assessment-form.component.html',
  styleUrl: './assessment-form.component.scss',
})
export class AssessmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  readonly request = inject(AssessmentRequestService);
  private readonly analytics = inject(AnalyticsService);

  readonly people = ASSESSMENT_PEOPLE;
  readonly keepOptions = ASSESSMENT_KEEP;
  readonly storage = ASSESSMENT_STORAGE;
  readonly contact = CONTACT_DETAILS;

  readonly form = this.fb.nonNullable.group({
    audience: ['' as AssessmentAudience | '', Validators.required],
    organization: ['', Validators.maxLength(120)],
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    email: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(255)],
    ],
    phone: [
      '',
      [Validators.maxLength(20), Validators.pattern(/^[0-9+().\s-]*$/)],
    ],
    people: ['', Validators.required],
    keep: this.fb.nonNullable.group(
      Object.fromEntries(ASSESSMENT_KEEP.map((option) => [option.value, false]))
    ),
    storage: ['', Validators.required],
    currentSpend: ['', Validators.maxLength(200)],
    notes: ['', Validators.maxLength(2000)],
    website: [''],
  });

  submitted = false;
  errors: FieldError[] = [];

  private readonly errorSummary =
    viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly successHeading =
    viewChild<ElementRef<HTMLElement>>('successHeading');
  private readonly failureMessage =
    viewChild<ElementRef<HTMLElement>>('failureMessage');

  constructor() {
    // Move focus to the result so screen reader and keyboard users hear it.
    effect(() => {
      const state = this.request.state();
      if (!isPlatformBrowser(this.platformId)) return;
      queueMicrotask(() => {
        if (state === 'sent') this.successHeading()?.nativeElement.focus();
        if (state === 'failed') this.failureMessage()?.nativeElement.focus();
      });
    });
  }

  get isOrganization(): boolean {
    return this.form.controls.audience.value === 'organization';
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name] as AbstractControl;
    return control.invalid && (control.touched || this.submitted);
  }

  submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.errors = this.collectErrors();
    if (this.errors.length) {
      // The summary renders on the next change detection; focus it after.
      afterNextRender(() => this.errorSummary()?.nativeElement.focus(), {
        injector: this.injector,
      });
      return;
    }

    const value = this.form.getRawValue();
    const answers: AssessmentAnswers = {
      audience: value.audience as AssessmentAudience,
      organization: value.organization,
      name: value.name,
      email: value.email,
      phone: value.phone,
      people: value.people,
      keep: Object.entries(value.keep)
        .filter(([, checked]) => checked)
        .map(([key]) => key),
      storage: value.storage,
      currentSpend: value.currentSpend,
      notes: value.notes,
    };
    this.request.submit(answers, value.website);
  }

  /** First interaction with the form counts as starting the assessment. */
  onStart(): void {
    this.analytics.trackOnce('assessment_start');
  }

  focusField(id: string): void {
    if (isPlatformBrowser(this.platformId)) {
      document.getElementById(id)?.focus();
    }
  }

  private collectErrors(): FieldError[] {
    const c = this.form.controls;
    const errors: FieldError[] = [];
    if (c.audience.invalid)
      errors.push({
        id: 'assessment-audience-home',
        message: 'Choose home or organization.',
      });
    if (c.name.invalid)
      errors.push({
        id: 'assessment-name',
        message: 'Enter your name (at least 2 characters).',
      });
    if (c.email.invalid)
      errors.push({
        id: 'assessment-email',
        message: 'Enter an email address we can reply to.',
      });
    if (c.phone.invalid)
      errors.push({
        id: 'assessment-phone',
        message: 'Enter a phone number using digits, spaces, or + ( ) - only.',
      });
    if (c.people.invalid)
      errors.push({
        id: 'assessment-people',
        message: 'Choose roughly how many people will use it.',
      });
    if (c.storage.invalid)
      errors.push({
        id: 'assessment-storage-under-500gb',
        message: 'Choose roughly how much you store, or "Not sure".',
      });
    if (c.notes.invalid)
      errors.push({
        id: 'assessment-notes',
        message: 'Keep notes under 2,000 characters.',
      });
    return errors;
  }
}
