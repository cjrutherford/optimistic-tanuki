import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ageFromDateOfBirth } from './age';

export interface DateOfBirthStepResult {
  dateOfBirth: string;
  guardianEmail?: string;
}

/**
 * The date-of-birth step of the age gate, shared by the OAuth callback. The
 * same age bands as the register block: under 13 is blocked, 13 to 17 needs a
 * guardian, 18 and over continues.
 */
@Component({
  selector: 'lib-date-of-birth-step',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="dob-step" (ngSubmit)="submit()">
      <label for="dob-step-date">Date of birth</label>
      <input
        id="dob-step-date"
        name="dateOfBirth"
        type="date"
        autocomplete="bday"
        required
        [(ngModel)]="dateOfBirth"
      />
      @if (age !== null && age < 13) {
      <p role="alert">You must be at least 13 to sign up.</p>
      } @else if (age !== null && age < 18) {
      <p>
        A parent or guardian must give permission before you can finish. We will
        email them a private link.
      </p>
      <label for="dob-step-guardian">Parent or guardian email</label>
      <input
        id="dob-step-guardian"
        name="guardianEmail"
        type="email"
        autocomplete="email"
        required
        [(ngModel)]="guardianEmail"
      />
      }
      <button type="submit" [disabled]="pending || age === null || age < 13">
        {{ age !== null && age < 18 ? 'Request permission' : 'Continue' }}
      </button>
    </form>
  `,
})
export class DateOfBirthStepComponent {
  @Input() pending = false;
  @Output() submitted = new EventEmitter<DateOfBirthStepResult>();
  dateOfBirth = '';
  guardianEmail = '';

  get age(): number | null {
    return ageFromDateOfBirth(this.dateOfBirth);
  }

  submit(): void {
    const age = this.age;
    if (age === null || age < 13) return;
    if (age < 18) {
      if (!this.guardianEmail.trim()) return;
      this.submitted.emit({
        dateOfBirth: this.dateOfBirth,
        guardianEmail: this.guardianEmail.trim(),
      });
      return;
    }
    this.submitted.emit({ dateOfBirth: this.dateOfBirth });
  }
}
