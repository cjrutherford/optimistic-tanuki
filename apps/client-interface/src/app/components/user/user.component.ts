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
export class UserComponent implements OnInit, OnDestroy {
  private readonly unsubscribe$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private readonly authState: AuthStateService,
    private readonly router: Router
  ) {}
  user: UserData | null = null;
  isLoggedIn = false;
  showPanel = false;

  ngOnInit() {
    this.authState.isAuthenticated$.pipe(takeUntil(this.unsubscribe$)).subscribe((isAuthenticated) => {
      this.isLoggedIn = isAuthenticated;
    });
    this.authState.decodedToken$.pipe(takeUntil(this.unsubscribe$)).subscribe((userData) => {
      this.user = userData;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  login() {
    this.router.navigate(['/login']);
  }

  register() {
    this.router.navigate(['/register']);
  }

  logout() {
    this.authState.logout();
    this.router.navigate(['/login']);
  }
}
