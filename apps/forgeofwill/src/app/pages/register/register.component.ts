import { RegisterSubmitType, submitTypeToRegisterRequest } from '@optimistic-tanuki/ui-models';

import { AuthenticationService } from '../../authentication.service';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [CommonModule, RegisterBlockComponent, CardComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly router: Router,
    private readonly messageService: MessageService,
  ) {}

  onSubmit(event: RegisterSubmitType) {
    console.log('Registering user with data:', event);
    const request = submitTypeToRegisterRequest(event);
    console.log('Converted request:', request);
    this.authService.register(request).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.messageService.addMessage({
          content: 'Registration successful!',
          type: 'success',
        });
        this.router.navigate(['/login']); // Redirect to login or another page after successful registration
        // Handle successful registration, e.g., redirect or show a success message
      },
      error: (error) => {
        console.error('Registration failed:', error);
        // Handle registration error, e.g., show an error message
        this.messageService.addMessage({
          content: 'Registration failed: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }
}
