import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';

@Component({
  selector: 'fc-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  template: `
    <lib-register-block
      registerHeader="Create Fin Commander Account"
      registerButtonText="Register"
      heroSrc="'images/register-splash.png'"
      callToAction="Create an account for your finance workspace."
      (submitEvent)="onSubmit($event)"
    />
  `,
})
export class RegisterComponent {
  private readonly authenticationService = inject(AuthenticationService);
  private readonly router = inject(Router);

  onSubmit(event: RegisterSubmitType) {
    this.authenticationService
      .register({
        email: event.email,
        password: event.password,
        confirm: event.confirmation,
        fn: event.firstName,
        ln: event.lastName,
        bio: event.bio,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
      });
  }
}
