import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'ot-finance-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="onboarding">
      <div class="panel">
        <p class="eyebrow">Setup</p>
        <h1>Continue in Fin Commander onboarding.</h1>
        <p class="copy">
          Finance setup now lives inside the main onboarding flow so you only
          see one guided path.
        </p>
        <a class="primary" href="/onboarding">Open onboarding</a>
      </div>
    </section>
  `,
  styles: [
    `
      .onboarding {
        display: grid;
        place-items: center;
        min-height: 70vh;
        color: var(--foreground, #1f2937);
        font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
      }
      .panel {
        width: min(760px, 100%);
        padding: 28px;
        border-radius: var(--border-radius-xl, 24px);
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
        box-shadow: var(--shadow-lg, 0 24px 60px rgba(15, 23, 42, 0.1));
      }
      .eyebrow {
        margin: 0 0 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #6b7280);
        font-size: 12px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: clamp(30px, 4vw, 48px);
        line-height: 1;
        font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif);
        max-width: 12ch;
      }
      .copy {
        color: var(--muted, #6b7280);
        max-width: 50ch;
        margin-bottom: 20px;
      }
      .primary {
        display: inline-flex;
        padding: 12px 18px;
        border: 0;
        border-radius: var(--border-radius-full, 999px);
        background: var(--accent, #d97706);
        color: var(--background, #ffffff);
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
      }
    `,
  ],
})
export class OnboardingComponent {
  private readonly router = inject(Router);

  constructor() {
    void this.router.navigateByUrl('/onboarding');
  }
}
