import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthStateService } from './auth-state.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="compass-landing">
      <section class="hero" aria-labelledby="landing-title">
        <p class="eyebrow">Opportunity Compass</p>
        <h1 id="landing-title">Opportunities worth pursuing.</h1>
        <p class="lede">
          Turn your interests, skills, and local context into a focused next
          move—not another noisy feed.
        </p>
        <div class="actions">
          <a class="primary" routerLink="/register"
            >Find your next opportunity</a
          >
          <a class="secondary" routerLink="/login">Sign in</a>
        </div>
        <ol class="path" aria-label="How Opportunity Compass works">
          <li><span>01</span> Build a signal-rich profile</li>
          <li><span>02</span> Discover relevant opportunities</li>
          <li><span>03</span> Choose and track the next action</li>
        </ol>
      </section>
    </main>
  `,
  styles: [
    `
      .compass-landing {
        min-height: calc(100vh - 56px);
        display: grid;
        place-items: center;
        padding: clamp(2rem, 7vw, 7rem) 1.25rem;
        color: var(--app-foreground);
        background: radial-gradient(
            circle at 82% 16%,
            color-mix(in srgb, var(--app-primary) 20%, transparent),
            transparent 35%
          ),
          var(--app-background);
      }
      .hero {
        width: min(56rem, 100%);
        border-left: 2px solid var(--app-primary);
        padding: clamp(1.75rem, 5vw, 4rem);
        background: color-mix(in srgb, var(--app-surface) 92%, transparent);
        box-shadow: 0 2rem 5rem
          color-mix(in srgb, var(--app-primary) 12%, transparent);
      }
      .eyebrow {
        margin: 0 0 1rem;
        color: var(--app-primary);
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        max-width: 11ch;
        margin: 0;
        font-family: var(--font-heading, Georgia, serif);
        font-size: clamp(3rem, 8vw, 6.5rem);
        line-height: 0.93;
        letter-spacing: -0.06em;
      }
      .lede {
        max-width: 38rem;
        margin: 1.5rem 0 0;
        font-size: clamp(1.05rem, 2vw, 1.3rem);
        line-height: 1.55;
        color: var(--app-foreground-muted);
      }
      .actions {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 2rem;
        align-items: center;
      }
      a {
        text-decoration: none;
        font-weight: 750;
      }
      .primary {
        padding: 0.9rem 1.2rem;
        background: var(--app-primary);
        color: var(--app-primary-foreground);
      }
      .secondary {
        color: var(--app-foreground);
        border-bottom: 1px solid currentColor;
      }
      .path {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin: 4rem 0 0;
        padding: 1.25rem 0 0;
        border-top: 1px solid var(--app-border);
        list-style: none;
      }
      .path li {
        display: grid;
        gap: 0.45rem;
        color: var(--app-foreground-muted);
        font-size: 0.92rem;
      }
      .path span {
        color: var(--app-primary);
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      @media (max-width: 640px) {
        .hero {
          padding: 2rem 1.25rem;
        }
        .path {
          grid-template-columns: 1fr;
          margin-top: 3rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        * {
          scroll-behavior: auto;
        }
      }
    `,
  ],
})
export class LandingComponent implements OnInit {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(filter(Boolean), take(1))
      .subscribe(() => void this.router.navigateByUrl('/leads'));
  }
}
