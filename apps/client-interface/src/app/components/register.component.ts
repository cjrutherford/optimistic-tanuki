/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';

import { Router } from '@angular/router';
import {
  RegisterRequest,
  RegisterSubmitType,
} from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  providers: [AuthenticationService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly router: Router
  ) {}

  onSubmit($event: RegisterSubmitType) {
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
      next: (response) => {
        console.log(response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error(error);
        // Handle registration errors (e.g., display error message to user)
      },
    });
  }
}
