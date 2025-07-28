import { AuthStateService } from '../../auth-state.service';
import { AuthenticationService } from '../../authentication.service copy';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';

@Component({
  selector: 'app-login',
  imports: [CommonModule, LoginBlockComponent, CardComponent],
  providers: [AuthenticationService, AuthStateService],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  constructor(private readonly authService: AuthenticationService, private readonly authState: AuthStateService) {}
}
