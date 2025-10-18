/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';

import { Subscription, filter } from 'rxjs';
import { inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    LoginBlockComponent
],
})
export class LoginComponent implements OnDestroy {
  private readonly messageService = inject(MessageService);
  themeSub: Subscription;
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };

  constructor(private readonly themeService: ThemeService, private readonly authStateService: AuthStateService, private readonly router: Router) {
    this.themeSub = this.themeService.themeColors$.pipe(filter(x => !!x)).subscribe((colors) => {
      this.themeStyles = {
        backgroundColor: colors.background,
        color: colors.foreground,
        border: `1px solid ${colors.accent}`,
      }
    });
  }

  ngOnDestroy() {
    this.themeSub.unsubscribe();
  }

  onSubmit($event: LoginType) {
    const event = $event as any;
    console.log(event);
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
    }
    this.authStateService.login(loginRequest).then((response) => {
      console.log(response);
      this.authStateService.setToken(response.data.newToken);
      if (this.authStateService.isAuthenticated) {
        // Load profiles and redirect accordingly
        import('../profile.service').then(({ ProfileService }) => {
          const profileService = new ProfileService(null as any, this.authStateService);
          profileService.getAllProfiles().then(() => {
            const currentProfiles = profileService.getCurrentUserProfiles();
            if (!currentProfiles.length) {
              this.router.navigate(['/profile'], { state: { showProfileModal: true, profileMessage: 'No profiles found. Please create a profile to continue.' } });
              this.messageService.addMessage({ content: 'No profiles found. Please create a profile to continue.', type: 'warning' });
            } else {
              profileService.selectProfile(currentProfiles[0]);
              this.router.navigate(['/feed']);
              this.messageService.addMessage({ content: 'Login successful! Welcome back.', type: 'success' });
            }
          });
        });
      }
    }).catch(err => {
      console.error(err);
    });
  }
}
