/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';

import { Subscription, filter } from 'rxjs';
import { inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../profile.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [LoginBlockComponent],
})
export class LoginComponent implements OnDestroy {
  private readonly messageService = inject(MessageService);
  themeSub: Subscription;
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  private readonly themeService: ThemeService = inject(ThemeService);
  private readonly authStateService: AuthStateService =
    inject(AuthStateService);
  private readonly router: Router = inject(Router);
  private readonly profileService = inject(ProfileService);

  constructor() {
    this.themeSub = this.themeService.themeColors$
      .pipe(filter((x) => !!x))
      .subscribe((colors) => {
        this.themeStyles = {
          backgroundColor: colors.background,
          color: colors.foreground,
          border: `1px solid ${colors.accent}`,
        };
      });
  }

  ngOnDestroy() {
    this.themeSub.unsubscribe();
  }

  async onSubmit($event: LoginType) {
    const event = $event as any;
    console.log(event);
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
    };
    try {
      const response = await this.authStateService.login(loginRequest);
      console.log(response);
      this.authStateService.setToken(response.data.newToken);
      if (this.authStateService.isAuthenticated) {
        const decoded = this.authStateService.getDecodedTokenValue();
        // If profileId is empty string, show only the profile creation modal
        if (decoded && decoded.profileId === '') {
          this.router.navigate(['/settings'], {
            state: {
              showProfileModal: false,
              profileMessage: 'Please create your profile to continue.',
            },
          });
          // this.messageService.addMessage({
          //   content: 'Please create your profile to continue.',
          //   type: 'warning',
          // });
          return;
        }
        // Otherwise load profiles and redirect accordingly
        await this.profileService.getAllProfiles();
        const currentProfiles = this.profileService.getCurrentUserProfiles();
        if (!currentProfiles.length) {
          this.router.navigate(['/settings'], {
            state: {
              showProfileModal: true,
              profileMessage:
                'No profiles found. Please create a profile to continue.',
            },
          });
          this.messageService.addMessage({
            content: 'No profiles found. Please create a profile to continue.',
            type: 'warning',
          });
        } else {
          this.profileService.selectProfile(currentProfiles[0]);
          this.router.navigate(['/feed']);
          this.messageService.addMessage({
            content: 'Login successful! Welcome back.',
            type: 'success',
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}
