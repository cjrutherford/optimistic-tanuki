/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { RegisterRequest, RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';

/**
 * Component for user registration.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatInputModule, MatButtonModule, MatCardModule, RegisterBlockComponent],
  providers: [AuthenticationService], 
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {

  /**
   * Creates an instance of RegisterComponent.
   * @param authenticationService The service for user authentication.
   * @param router The Angular router.
   */
  constructor(
    private readonly authenticationService: AuthenticationService, 
    private readonly router: Router,
  ) {}

  /**
   * Custom validator to check if password and confirmPassword match.
   * @param form The FormGroup to validate.
   * @returns A validation error object if passwords do not match, otherwise null.
   */
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  /**
   * Handles the form submission for registration.
   * @param $event The registration data from the form.
   */
  onSubmit($event: RegisterSubmitType) { 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formValue = $event as any;
    console.log('Form submitted:', formValue);
    const registerRequest: RegisterRequest = {
      email: formValue.email,
      password: formValue.password,
      confirm: formValue.confirmation, // Use confirmPassword from the form
      fn: formValue.firstName,
      ln: formValue.lastName,
      bio: formValue.bio,
    };

    this.authenticationService.register(registerRequest).subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (response) => {
        console.log(response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error(error);
        // Handle registration errors (e.g., display error message to user)
      }
    });
  }
}
