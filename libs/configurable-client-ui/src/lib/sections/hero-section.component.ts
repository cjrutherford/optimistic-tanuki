import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { HeroSection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero-section">
      @if (section.background?.src && !section.backgroundImage) {
      <div
        class="hero-background"
        [style.background-image]="'url(' + section.background?.src + ')'"
        [style.background-size]="section.background?.fit || 'cover'"
        [style.background-position]="backgroundPosition()"
      ></div>
      }
      <div class="hero-content">
        <h1>{{ section.title }}</h1>
        @if (section.subtitle) {
        <p class="subtitle">{{ section.subtitle }}</p>
        } @if (section.ctaText && section.ctaLink) {
        <a [href]="section.ctaLink" class="cta-button">{{ section.ctaText }}</a>
        }
      </div>
      @if (section.backgroundImage) {
      <div
        class="hero-background"
        [style.background-image]="'url(' + section.backgroundImage + ')'"
      ></div>
      }
    </section>
  `,
  styles: [
    `
      .hero-section {
        position: relative;
        min-height: 500px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        overflow: hidden;
        color: var(--foreground, var(--text-color, #111827));
        background: var(--background, var(--background-color, #ffffff));
      }

      .hero-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        z-index: -1;
        opacity: 0.3;
      }

      .hero-content {
        max-width: 800px;
        z-index: 1;
      }

      h1 {
        font-size: 3rem;
        font-weight: bold;
        margin-bottom: 1rem;
      }

      .subtitle {
        font-size: 1.5rem;
        margin-bottom: 2rem;
      }

      .cta-button {
        display: inline-block;
        padding: 1rem 2rem;
        background-color: var(--primary, var(--primary-color, #007bff));
        color: var(--primary-foreground, white);
        text-decoration: none;
        border-radius: 4px;
        font-weight: 600;
        transition: background-color 0.3s;
      }

      .cta-button:hover {
        background-color: color-mix(
          in srgb,
          var(--primary, var(--primary-color, #007bff)) 88%,
          black
        );
      }
    `,
  ],
})
export class HeroSectionComponent {
  @Input() section!: HeroSection;

  backgroundPosition(): string {
    return (
      {
        center: 'center center',
        top: 'center top',
        right: 'right center',
        bottom: 'center bottom',
        left: 'left center',
      }[this.section.background?.focalPoint ?? 'center'] ?? 'center center'
    );
  }
}
