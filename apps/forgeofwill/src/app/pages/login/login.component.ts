import { AuthStateService } from '../../auth-state.service';
import { AuthenticationService } from '../../authentication.service';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../../profile/profile.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule, LoginBlockComponent, CardComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly authState: AuthStateService,
    private readonly profileService: ProfileService,
    private readonly router: Router
  ) {}

  onLoginSubmit(event: LoginType) {
    console.log('Logging in user with data:', event);
    this.authService.login(event).then((response) => {
      console.log('Login successful:', response);
      this.authState.setToken(response.data.newToken);
      if(this.authState.isAuthenticated) {
        this.profileService.getAllProfiles().then(() => {
          console.log('Profiles loaded successfully');
          const currentProfiles = this.profileService.currentUserProfiles();
          console.log('Current user profiles:', currentProfiles);
          if(!currentProfiles.length) {
            console.warn('No profiles found for the current user. Redirecting to profile creation.');
            // Redirect to profile creation if no profiles exist
            this.router.navigate(['/profile']); 
          } else {
            this.profileService.selectProfile(currentProfiles[0]);
            this.router.navigate(['/']);
          }
        });
      }
    }).catch((error) => {
      console.error('Login failed:', error);
    });
  }
}
