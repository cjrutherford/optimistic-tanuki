import { Component, OnInit, OnDestroy } from '@angular/core';
import { takeUntil, Subject } from 'rxjs';
import { AuthStateService, UserData } from '../../state/auth-state.service';
import { Router } from '@angular/router';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  providers: [AuthStateService],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
/**
 * Component for displaying user information and handling authentication actions.
 */
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  providers: [AuthStateService],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UserComponent implements OnInit, OnDestroy {
  private readonly unsubscribe$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  /**
   * Creates an instance of UserComponent.
   * @param authState The authentication state service.
   * @param router The Angular router.
   */
  constructor(
    private readonly authState: AuthStateService,
    private readonly router: Router
  ) {}
  /**
   * The decoded user data from the authentication token.
   */
  user: UserData | null = null;
  /**
   * Indicates whether the user is logged in.
   */
  isLoggedIn = false;
  /**
   * Indicates whether the user panel is shown.
   */
  showPanel = false;

  /**
   * Initializes the component and subscribes to authentication state and user data changes.
   */
  ngOnInit() {
    this.authState.isAuthenticated$.pipe(takeUntil(this.unsubscribe$)).subscribe((isAuthenticated) => {
      this.isLoggedIn = isAuthenticated;
    });
    this.authState.decodedToken$.pipe(takeUntil(this.unsubscribe$)).subscribe((userData) => {
      this.user = userData;
    });
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Navigates to the login page.
   */
  login() {
    this.router.navigate(['/login']);
  }

  /**
   * Navigates to the registration page.
   */
  register() {
    this.router.navigate(['/register']);
  }

  /**
   * Logs out the user and navigates to the login page.
   */
  logout() {
    this.authState.logout();
    this.router.navigate(['/login']);
  }
}
