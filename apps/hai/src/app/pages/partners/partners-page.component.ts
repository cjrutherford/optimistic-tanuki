import { Component } from '@angular/core';
import { PartnerSectionComponent } from '../../components/landing/partner-section.component';
import { PARTNER_BENEFITS } from '../../content/site-content';

@Component({
  selector: 'hai-partners-page',
  standalone: true,
  imports: [PartnerSectionComponent],
  template: `
    <h1 class="visually-hidden">Partners</h1>
    <hai-partner-section [benefits]="benefits"></hai-partner-section>
  `,
})
export class PartnersPageComponent {
  readonly benefits = PARTNER_BENEFITS;
}
