import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterRequest, RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../services/authentication.service';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  template: `
    <div class="register-container">
      <div class="register-content">
        <h1>Create Your Account</h1>
        <p>Join the video platform community</p>
        <otui-register-block (submitEvent)="onSubmit($event)"></otui-register-block>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .register-content {
      max-width: 500px;
      width: 100%;
    }

    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      text-align: center;
    }

    p {
      margin: 0 0 2rem 0;
      text-align: center;
      opacity: 0.8;
    }
  `]
})
export class RegisterComponent {
  private readonly authenticationService = inject(AuthenticationService);
  private readonly router = inject(Router);

  onSubmit($event: RegisterSubmitType) {
    const formValue = $event as any;
    const registerRequest: RegisterRequest = {
      email: formValue.email,
      password: formValue.password,
      confirm: formValue.confirmation,
      fn: formValue.firstName,
      ln: formValue.lastName,
      bio: formValue.bio,
    };

    this.authenticationService.register(registerRequest).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Registration error:', error);
      },
    });
  }
}
