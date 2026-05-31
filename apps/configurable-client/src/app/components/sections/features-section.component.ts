import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeaturesSection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="features-section">
      <h2>{{ section.title }}</h2>
      <div class="features-grid">
        @for (feature of section.features; track feature.title) {
        <div class="feature-card">
          @if (feature.icon) {
          <div class="feature-icon">{{ feature.icon }}</div>
          }
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .features-section {
        padding: 4rem 2rem;
        color: var(--foreground, #111827);
        background: var(--background, #ffffff);
      }

      h2 {
        text-align: center;
        font-size: 2.5rem;
        margin-bottom: 3rem;
      }

      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .feature-card {
        padding: 2rem;
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        text-align: center;
        background: var(--surface, #ffffff);
      }

      .feature-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      p {
        color: color-mix(in srgb, var(--foreground, #111827) 70%, transparent);
        line-height: 1.6;
      }
    `,
  ],
})
export class FeaturesSectionComponent {
  @Input() section!: FeaturesSection;
}
