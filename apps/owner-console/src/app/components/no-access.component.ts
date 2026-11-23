import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { OwnerAccessService } from '../services/owner-access.service';

@Component({
  selector: 'app-no-access',
  standalone: true,
  template: `
    <section class="no-access" aria-labelledby="no-access-title">
      <h1 id="no-access-title">You don't have access to the owner console</h1>
      <p>
        You're signed in, but this account has no owner role. Ask an existing
        owner to grant access, or sign in with a different account.
      </p>
      <button type="button" class="signout" (click)="signOut()">
        Sign out
      </button>
    </section>
  `,
  styles: [
    `
      :host {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 2rem;
      }

      .no-access {
        max-width: 32rem;
        padding: 2rem;
        border: 1px solid var(--border-color);
        border-radius: var(--personality-card-radius, 12px);
        background: var(--surface);
        color: var(--foreground);
        font-family: var(--font-body, inherit);
        font-size: var(--type-body, 1rem);
        line-height: var(--line-height, 1.5);
      }

      h1 {
        margin: 0 0 1rem;
        font-family: var(--font-heading, inherit);
        font-size: var(--type-h2, 1.5rem);
        line-height: var(--heading-line-height, 1.2);
      }

      p {
        margin: 0 0 1.5rem;
      }

      .signout {
        padding: 0.625rem 1.25rem;
        border: 1px solid var(--border-color);
        border-radius: var(--personality-input-radius, 8px);
        background: var(--primary);
        color: var(--primary-text, var(--foreground));
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .signout:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
    `,
  ],
})
export class NoAccessComponent {
  private readonly auth = inject(AuthService);
  private readonly access = inject(OwnerAccessService);

  signOut(): void {
    this.access.reset();
    this.auth.logout();
  }
}
