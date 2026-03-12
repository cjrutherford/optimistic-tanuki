import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="account-page">
      <h1>My Account</h1>
      <p>Account management coming in Phase 2.</p>
      <button class="btn" (click)="logout()">Logout</button>
    </div>
  `,
  styles: [`
    .account-page {
      max-width: 600px;
      margin: 48px auto;
      padding: 0 16px;
    }
    h1 {
      margin-bottom: 16px;
    }
    .btn {
      margin-top: 24px;
      padding: 10px 22px;
      border-radius: 8px;
      background: var(--primary, #3f51b5);
      color: white;
      border: none;
      font-size: 0.95rem;
      cursor: pointer;
      &:hover {
        background: var(--primary-dark, #303f9f);
      }
    }
  `],
})
export class AccountComponent {
  private authState = inject(AuthStateService);
  private router = inject(Router);

  logout(): void {
    this.authState.logout();
    this.router.navigate(['/']);
  }
}
