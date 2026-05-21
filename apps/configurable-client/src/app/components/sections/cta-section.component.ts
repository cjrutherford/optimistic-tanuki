import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CTASection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="cta-section">
      <div class="cta-content">
        <h2>{{ section.title }}</h2>
        @if (section.description) {
          <p>{{ section.description }}</p>
        }
        <a [href]="section.buttonLink" class="cta-button">{{ section.buttonText }}</a>
      </div>
    </section>
  `,
  styles: [`
    .cta-section {
      padding: 4rem 2rem;
      background-color: var(--primary-color, #007bff);
      color: white;
      text-align: center;
    }
    .cta-content {
      max-width: 800px;
      margin: 0 auto;
    }
    .cta-button {
      display: inline-block;
      margin-top: 2rem;
      padding: 1rem 2rem;
      background-color: white;
      color: var(--primary-color, #007bff);
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }
  `],
})
export class CtaSectionComponent {
  @Input() section!: CTASection;
}
