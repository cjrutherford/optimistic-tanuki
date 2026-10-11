import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HardwareCatalogComponent } from '../../components/hardware-catalog/hardware-catalog.component';
import { PricingTermsComponent } from '../../components/pricing/pricing-terms.component';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { AudienceSelectorComponent } from '../../components/shared/audience-selector.component';
import {
  APPLIANCES_HERO,
  ASSESSMENT_ROUTE,
  PRIVATE_CLOUD_APPLIANCE_NOTE,
  PRIVATE_CLOUD_APPLIANCE_TIERS,
} from '../../content/private-cloud';

@Component({
  selector: 'hai-turn-key-appliances-page',
  standalone: true,
  imports: [
    RouterLink,
    PageIntroComponent,
    PricingTermsComponent,
    HardwareCatalogComponent,
    AudienceSelectorComponent,
  ],
  template: `
    <hai-page-intro
      [eyebrow]="hero.eyebrow"
      [title]="hero.title"
      [summary]="hero.summary"
      [action]="hero.action"
      [links]="hero.links"
    ></hai-page-intro>
    <hai-hardware-catalog></hai-hardware-catalog>
    <hai-pricing-terms></hai-pricing-terms>
    <hai-audience-selector
      sectionId="private-cloud-appliances"
      eyebrow="Private cloud appliances"
      heading="A private cloud appliance, sized to what you keep."
      [paths]="tiers"
      [columns]="3"
      [note]="note"
    ></hai-audience-selector>
    <p class="appliance-links">
      <a routerLink="/private-cloud">What a private cloud includes</a>
      <a routerLink="/private-cloud/open-source-stack">
        The open-source software it runs
      </a>
      <a [routerLink]="assessmentRoute">Start an assessment</a>
    </p>
  `,
  styleUrl: './turn-key-appliances-page.component.scss',
})
export class TurnKeyAppliancesPageComponent {
  readonly hero = APPLIANCES_HERO;
  readonly tiers = PRIVATE_CLOUD_APPLIANCE_TIERS;
  readonly note = PRIVATE_CLOUD_APPLIANCE_NOTE;
  readonly assessmentRoute = ASSESSMENT_ROUTE;
}
