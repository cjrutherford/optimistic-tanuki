import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'flow-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(CustomerAuthService);
  private readonly router = inject(Router);
  readonly brandConfig = inject(BrandConfigService);

  registerForm: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.pattern(/\s+/)],
    ],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]],
  });

  errorMessage = '';
  statusMessage = '';
  isSubmitting = false;

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.statusMessage = '';

    const { name, email, password } = this.registerForm.value;
    this.auth.register({ name, email, password }).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.verificationRequired) {
          this.statusMessage =
            'Account created. Check your email to verify it, then sign in.';
          return;
        }
        void this.router.navigate(['/estimate']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage =
          err?.message || 'Registration failed. Please try again.';
      },
    });
  }
}
