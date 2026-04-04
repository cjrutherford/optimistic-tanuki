import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../state/auth-state.service';
import { ProfileService } from '../../state/profile.service';
import { ReturnIntentService } from '../../state/return-intent.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginBlockComponent, CardComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly authService = inject(AuthenticationService);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly returnIntent = inject(ReturnIntentService);

  async onLoginSubmit(event: LoginType): Promise<void> {
    try {
      const response = await this.authService.login(event);
      this.authState.setToken(response.data.newToken);
      await this.profileService.getAllProfiles();

      const effectiveProfile = this.profileService.getEffectiveProfile();
      if (effectiveProfile) {
        this.profileService.selectProfile(effectiveProfile);
        const returnUrl = this.returnIntent.consume() || '/';
        this.router.navigate([returnUrl]);
        this.messageService.addMessage({
          content: 'Welcome back to HAI Computer.',
          type: 'success',
        });
        return;
      }

      this.router.navigate(['/profile-gate']);
      this.messageService.addMessage({
        content: 'Choose or create a profile to continue your system order.',
        type: 'warning',
      });
    } catch (error) {
      console.error('Login failed', error);
      this.messageService.addMessage({
        content: 'Login failed. Please verify your email and password.',
        type: 'error',
      });
    }
  }
}
