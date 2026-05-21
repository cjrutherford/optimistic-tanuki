import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUDIENCE_PERSONAS, OFFERING_PRESETS } from '../data/presets';

@Component({
  selector: 'app-landing-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="hero-grid">
      <article class="hero-copy">
        <span class="eyebrow">Marketing studio for products with actual shape</span>
        <h1>Turn product context into strategy, channel drafts, and material-ready campaign outputs.</h1>
        <p class="lede">
          Signal Foundry creates grouped marketing workbenches for repo-backed products, custom apps,
          and web development services. Start with a studio brief, choose your outputs, then tune the
          copy after generation.
        </p>

        <div class="hero-actions">
          <a class="cta primary" routerLink="/create">Build a workbench</a>
          <a class="cta secondary" routerLink="/results">Review outputs</a>
        </div>
      </article>

      <aside class="hero-panel">
        <div class="metric-card">
          <strong>5+</strong>
          <span>strategy directions per request</span>
        </div>
        <div class="metric-card">
          <strong>{{ offeringsCount }}</strong>
          <span>starting offerings across apps and services</span>
        </div>
        <div class="metric-card">
          <strong>{{ audienceCount }}</strong>
          <span>preset personas built for operator-facing messaging</span>
        </div>
      </aside>
    </section>

    <section class="band">
      <div class="section-head">
        <span class="eyebrow">What it configures</span>
        <h2>Offerings, audience, strategy, outputs, and brand direction.</h2>
      </div>

      <div class="cards">
        <article class="card">
          <h3>Strategy + outputs</h3>
          <p>Each run produces concept directions, channel-native drafts, and selected material deliverables.</p>
        </article>
        <article class="card">
          <h3>Custom app briefs</h3>
          <p>Define a new product with features, differentiators, and a primary goal before generation.</p>
        </article>
        <article class="card">
          <h3>Brand-guided runs</h3>
          <p>Carry colors, style notes, and image intent into the generated outputs instead of relying on hidden defaults.</p>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .hero-grid,
      .band {
        display: grid;
        gap: 1.25rem;
      }

      .hero-grid {
        grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
        align-items: stretch;
        margin-top: 1rem;
      }

      .hero-copy,
      .hero-panel,
      .card {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background:
          linear-gradient(180deg, color-mix(in srgb, var(--primary, #d97706) 12%, transparent), transparent),
          color-mix(in srgb, var(--surface, #10151c) 92%, transparent);
        border-radius: var(--border-radius-lg, 20px);
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
      }

      .hero-copy {
        padding: clamp(1.6rem, 5vw, 4rem);
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--primary, #d97706);
        font-size: 0.75rem;
      }

      h1,
      h2 {
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 500;
        line-height: 0.98;
        margin: 0.5rem 0 1rem;
        text-wrap: balance;
      }

      h1 {
        font-size: clamp(3rem, 7vw, 5.8rem);
        max-width: 11ch;
      }

      h2 {
        font-size: clamp(2.2rem, 4vw, 3.4rem);
        max-width: 14ch;
      }

      .lede,
      .card p {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        line-height: 1.7;
        max-width: 56ch;
      }

      .hero-actions {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 2rem;
      }

      .cta {
        text-decoration: none;
        padding: 0.95rem 1.35rem;
        border-radius: 999px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      }

      .cta.primary {
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #d97706, #2563eb));
        border-color: transparent;
      }

      .cta.secondary {
        background: color-mix(in srgb, var(--foreground, #fff) 6%, transparent);
      }

      .hero-panel {
        padding: 1.2rem;
        display: grid;
        gap: 1rem;
      }

      .metric-card {
        padding: 1.1rem;
        border-radius: 1.2rem;
        background: color-mix(in srgb, var(--surface, #10151c) 84%, transparent);
        border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 90%, transparent);
      }

      .metric-card strong {
        display: block;
        font-size: 2.4rem;
        margin-bottom: 0.35rem;
      }

      .band {
        margin-top: 1.5rem;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .card {
        padding: 1.3rem;
      }

      .cta:focus-visible {
        outline: 2px solid var(--primary, #d97706);
        outline-offset: 2px;
      }

      @media (max-width: 980px) {
        .hero-grid,
        .cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LandingPageComponent {
  protected readonly offeringsCount = OFFERING_PRESETS.length;
  protected readonly audienceCount = AUDIENCE_PERSONAS.length;
}
