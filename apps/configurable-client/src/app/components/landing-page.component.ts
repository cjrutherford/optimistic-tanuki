import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigurationService } from '../services/configuration.service';
import { Section, AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { HeroSectionComponent } from './sections/hero-section.component';
import { FeaturesSectionComponent } from './sections/features-section.component';
import { ContentSectionComponent } from './sections/content-section.component';
import { GridSectionComponent } from './sections/grid-section.component';
import { CtaSectionComponent } from './sections/cta-section.component';
import { FooterSectionComponent } from './sections/footer-section.component';

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
    <div class="landing-page" [ngClass]="'layout-' + layout">
      @for (section of sections; track section.id) {
        @if (section.visible) {
          @switch (section.type) {
            @case ('hero') {
              <app-hero-section [section]="section"></app-hero-section>
            }
            @case ('features') {
              <app-features-section [section]="section"></app-features-section>
            }
            @case ('content') {
              <app-content-section [section]="section"></app-content-section>
            }
            @case ('grid') {
              <app-grid-section [section]="section"></app-grid-section>
            }
            @case ('cta') {
              <app-cta-section [section]="section"></app-cta-section>
            }
            @case ('footer') {
              <app-footer-section [section]="section"></app-footer-section>
            }
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .landing-page {
        width: 100%;
      }

      .layout-single-column {
        max-width: 1200px;
        margin: 0 auto;
      }

      .layout-wide {
        max-width: 100%;
      }

      .layout-sidebar {
        display: grid;
        grid-template-columns: 250px 1fr;
        gap: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }
    `,
  ],
})
export class LandingPageComponent implements OnInit {
  private configService = inject(ConfigurationService);

  sections: Section[] = [];
  layout = 'single-column';



  ngOnInit(): void {
    const config = this.configService.getCurrentConfiguration();
    if (config) {
      this.sections = config.landingPage.sections.sort(
        (a, b) => a.order - b.order
      );
      this.layout = config.landingPage.layout;
    }
  }
}
