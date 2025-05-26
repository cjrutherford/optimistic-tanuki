/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { RegisterRequest } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatInputModule, MatButtonModule, MatCardModule, RegisterBlockComponent],
  providers: [AuthenticationService], 
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;

  constructor(
    private readonly authenticationService: AuthenticationService, 
    private readonly router: Router,
    private fb: FormBuilder
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      dateOfBirth: [''], // Optional based on your requirements
      bio: [''], // Optional
      avatar: [''], // Optional
      banner: [''], // Optional
      username: ['', Validators.required] // Assuming username is required
    }, { validator: this.passwordMatchValidator }); // Added custom validator for password match

  }

  // Custom validator to check if password and confirmPassword match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit($event: SubmitEvent) { 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formValue = $event as any;
    if (this.registerForm.invalid) {
      // Mark all fields as touched to display validation errors
      this.registerForm.markAllAsTouched();
      return;
    }
    const registerRequest: RegisterRequest = {
      email: formValue.email,
      password: formValue.password,
      confirm: formValue.confirmPassword, // Use confirmPassword from the form
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      bio: formValue.bio,
    };

    this.authenticationService.register(registerRequest).subscribe(
      (response) => {
        console.log(response);
        this.router.navigate(['/login']);
      },
      (error) => {
        console.error(error);
        // Handle registration errors (e.g., display error message to user)
      }
    );
  }
}
