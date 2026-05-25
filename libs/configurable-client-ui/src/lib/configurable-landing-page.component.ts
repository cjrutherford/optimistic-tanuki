import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AppConfiguration,
  Section,
  SectionMediaItem,
} from '@optimistic-tanuki/app-config-models';

import { ContentSectionComponent } from './sections/content-section.component';
import { CtaSectionComponent } from './sections/cta-section.component';
import { FeaturesSectionComponent } from './sections/features-section.component';
import { FooterSectionComponent } from './sections/footer-section.component';
import { GridSectionComponent } from './sections/grid-section.component';
import { HeroSectionComponent } from './sections/hero-section.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    FeaturesSectionComponent,
    ContentSectionComponent,
    GridSectionComponent,
    CtaSectionComponent,
    FooterSectionComponent,
  ],
  template: `
    <div
      class="landing-page"
      [ngClass]="[
        'layout-' + layout,
        embeddedPreview ? 'embedded-preview' : ''
      ]"
    >
      @for (section of sections; track section.id) { @if (section.visible) {
      <div
        class="preview-section-shell"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        [attr.data-section-id]="section.id"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (embeddedPreview && section.motion?.kind && section.motion?.kind !==
        'none') {
        <div
          class="preview-motion-overlay"
          [class]="'motion-' + section.motion?.kind"
        ></div>
        } @switch (section.type) { @case ('hero') {
        <app-hero-section [section]="section"></app-hero-section>
        } @case ('features') {
        <app-features-section [section]="section"></app-features-section>
        } @case ('content') {
        <app-content-section [section]="section"></app-content-section>
        } @case ('grid') {
        <app-grid-section [section]="section"></app-grid-section>
        } @case ('cta') {
        <app-cta-section [section]="section"></app-cta-section>
        } @case ('footer') {
        <app-footer-section [section]="section"></app-footer-section>
        } }
      </div>
      } }
    </div>
  `,
  styles: [
    `
      .landing-page {
        width: 100%;
        display: grid;
        gap: 1.25rem;
      }

      .landing-page.embedded-preview {
        min-height: 100%;
        padding: clamp(0.75rem, 1.8vw, 1.25rem);
        gap: 1rem;
        border-radius: 1.5rem;
        background: linear-gradient(
          180deg,
          color-mix(
              in srgb,
              var(--primary, #3f51b5) 4%,
              var(--background, #ffffff)
            )
            0%,
          var(--background, #ffffff) 100%
        );
      }

      .preview-section-shell {
        position: relative;
        isolation: isolate;
      }

      .preview-motion-overlay {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        border-radius: 1rem;
        pointer-events: none;
        opacity: 0.7;
      }

      .preview-motion-overlay::before {
        content: '';
        position: absolute;
        inset: -20%;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary, #3f51b5) 28%, transparent),
            transparent 45%
          ),
          radial-gradient(
            circle at bottom right,
            color-mix(in srgb, var(--secondary, #ff4081) 20%, transparent),
            transparent 42%
          );
        animation: preview-motion-drift 14s linear infinite;
      }

      .preview-motion-overlay.motion-particle-veil::before,
      .preview-motion-overlay.motion-signal-mesh::before,
      .preview-motion-overlay.motion-aurora-ribbon::before,
      .preview-motion-overlay.motion-shimmer-beam::before,
      .preview-motion-overlay.motion-glass-fog::before,
      .preview-motion-overlay.motion-pulse-rings::before,
      .preview-motion-overlay.motion-topographic-drift::before,
      .preview-motion-overlay.motion-parallax-grid-warp::before {
        opacity: 1;
      }

      .landing-page.embedded-preview .preview-section-shell {
        cursor: pointer;
        border-radius: 1rem;
      }

      .landing-page.embedded-preview .preview-section-shell::after {
        content: '';
        position: absolute;
        inset: -0.35rem;
        border-radius: calc(1rem + 0.35rem);
        border: 2px solid transparent;
        pointer-events: none;
        transition: border-color 0.18s ease, background-color 0.18s ease;
      }

      .landing-page.embedded-preview .preview-section-shell:hover::after,
      .landing-page.embedded-preview
        .preview-section-shell.preview-section-selected::after {
        border-color: color-mix(in srgb, var(--primary, #3f51b5) 72%, white);
        background: color-mix(in srgb, var(--primary, #3f51b5) 8%, transparent);
      }

      .layout-single-column {
        max-width: min(1480px, 100%);
        margin: 0 auto;
      }

      .layout-wide {
        max-width: min(1600px, 100%);
        margin: 0 auto;
      }

      .layout-sidebar {
        display: grid;
        grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr);
        gap: 1.5rem;
        max-width: min(1520px, 100%);
        margin: 0 auto;
      }

      @keyframes preview-motion-drift {
        0% {
          transform: translate3d(-2%, -1%, 0) scale(1);
        }

        50% {
          transform: translate3d(2%, 1%, 0) scale(1.08);
        }

        100% {
          transform: translate3d(-2%, -1%, 0) scale(1);
        }
      }
    `,
  ],
})
export class ConfigurableLandingPageComponent {
  @Input() config: AppConfiguration | null = null;
  @Input() embeddedPreview = false;
  @Input() selectedSectionId: string | null = null;

  @Output() sectionSelected = new EventEmitter<string>();

  get sections(): Section[] {
    if (!this.config) {
      return [];
    }

    return [...this.config.landingPage.sections].sort(
      (a, b) => a.order - b.order
    );
  }

  get layout(): string {
    return this.config?.landingPage.layout ?? 'single-column';
  }

  mediaObjectPosition(item: SectionMediaItem | undefined): string {
    return (
      {
        center: 'center center',
        top: 'center top',
        right: 'right center',
        bottom: 'center bottom',
        left: 'left center',
      }[item?.focalPoint ?? 'center'] ?? 'center center'
    );
  }

  onPreviewSectionClick(event: MouseEvent, sectionId: string): void {
    if (!this.embeddedPreview) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.sectionSelected.emit(sectionId);
  }
}
