/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  OnDestroy,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';
import { CommonModule } from '@angular/common';
import { Subscription, filter } from 'rxjs';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    LoginBlockComponent
  ],
})
export class LoginComponent implements OnDestroy {
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
        this.router.navigate(['/feed']);
      }
    }).catch(err => {
      console.error(err);
    });
  }
}
