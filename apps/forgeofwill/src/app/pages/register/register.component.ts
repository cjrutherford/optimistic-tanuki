import { AuthStateService } from '../../auth-state.service';
import { AuthenticationService } from '../../authentication.service copy';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';

@Component({
  selector: 'app-register',
  imports: [CommonModule, RegisterBlockComponent, CardComponent],
  providers: [AuthenticationService, AuthStateService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly authState: AuthStateService
  ) {}
}
