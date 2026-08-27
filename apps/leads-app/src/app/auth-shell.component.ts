import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared marketing-column + panel layout for the login and register routes.
 *
 * Both routes previously carried an identical ~85-line copy of this style block
 * inline, which drifted and hardcoded the header height. The auth blocks render
 * their own hero, so hosts using this shell pass `[showHero]="false"` and let
 * this component own the single page headline.
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="auth-shell">
      <div class="auth-copy">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ headline }}</h1>
        <p class="lede">{{ lede }}</p>
        <div class="signal-grid" aria-hidden="true">
          @for (signal of signals; track signal) {
          <span>{{ signal }}</span>
          }
        </div>
      </div>
      <div class="auth-panel">
        <ng-content></ng-content>
        <p class="auth-switch">
          {{ switchPrompt }}
          <a [routerLink]="switchLink">{{ switchLabel }}</a>
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        /* Both tracks flex; the panel is no longer pinned to a fixed width
           that squeezed the form inside it. */
        grid-template-columns: minmax(0, 1fr);
        gap: clamp(2rem, 5vw, 4rem);
        align-items: center;
        justify-items: center;
        padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 2rem);
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--app-primary) 12%, transparent),
            transparent 24rem
          ),
          radial-gradient(
            circle at bottom right,
            color-mix(in srgb, var(--app-accent) 12%, transparent),
            transparent 26rem
          ),
          linear-gradient(
            180deg,
            var(--app-surface) 0%,
            var(--app-background) 100%
          );
      }

      @media (min-width: 60rem) {
        .auth-shell {
          grid-template-columns: minmax(0, 26rem) minmax(0, 34rem);
          justify-content: center;
          justify-items: stretch;
        }
      }

      .auth-copy {
        display: grid;
        gap: 1rem;
        max-width: 34rem;
        min-width: 0;
      }

      .eyebrow {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--app-primary);
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 1.03;
        letter-spacing: -0.03em;
        text-wrap: balance;
      }

      .lede {
        margin: 0;
        color: var(--app-foreground-secondary);
        line-height: 1.7;
        max-width: 42ch;
      }

      .signal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: 0.75rem;
        margin-top: 0.25rem;
      }

      .signal-grid span {
        padding: 0.85rem 1rem;
        border-radius: var(--border-radius-md, 0.75rem);
        background: var(--app-surface);
        border: 1px solid var(--app-border);
        font-size: 0.92rem;
        font-weight: 600;
        color: var(--app-foreground);
      }

      .auth-panel {
        display: grid;
        gap: 1rem;
        width: 100%;
        min-width: 0;
      }

      .auth-switch {
        margin: 0;
        text-align: center;
        color: var(--app-foreground-secondary);
        font-size: 0.95rem;
      }

      .auth-switch a {
        color: var(--app-primary);
        font-weight: 600;
      }
    `,
  ],
})
export class AuthShellComponent {
  @Input() eyebrow = 'Lead Command';
  @Input() headline = '';
  @Input() lede = '';
  @Input() signals: string[] = [];
  @Input() switchPrompt = '';
  @Input() switchLabel = '';
  @Input() switchLink = '/login';
}
