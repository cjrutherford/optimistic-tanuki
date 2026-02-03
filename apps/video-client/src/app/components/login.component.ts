import { Component, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LoginRequest, LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginBlockComponent],
  template: `
    <div class="login-container" [ngStyle]="themeStyles">
      <div class="login-content">
        <h1>Welcome to Video Platform</h1>
        <p>Sign in to watch, upload, and interact with videos</p>
        <otui-login-block (submitEvent)="onSubmit($event)"></otui-login-block>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .login-content {
      max-width: 400px;
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
export class LoginComponent implements OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly authStateService = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  
  themeStyles: any = {};
  private themeSub: Subscription;

  constructor() {
    this.themeSub = this.themeService.themeColors$
      .pipe(filter((x) => !!x))
      .subscribe((colors) => {
        this.themeStyles = {
          backgroundColor: colors.background,
          color: colors.foreground,
        };
      });
  }

  ngOnDestroy() {
    this.themeSub.unsubscribe();
  }

  async onSubmit($event: LoginType) {
    const event = $event as any;
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
    };
    
    try {
      const response = await this.authStateService.login(loginRequest);
      this.authStateService.setToken(response.data.newToken);
      
      if (this.authStateService.isAuthenticated) {
        const decoded = this.authStateService.getDecodedTokenValue();
        
        if (decoded && decoded.profileId === '') {
          this.router.navigate(['/profile']);
          return;
        }
        
        await this.profileService.getAllProfiles();
        const currentProfiles = this.profileService.getCurrentUserProfiles();
        
        if (currentProfiles.length > 0) {
          this.profileService.selectProfile(currentProfiles[0]);
        }
        
        this.router.navigate(['/']);
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  }
}
