import { Component } from '@angular/core';
import {
  BadgeComponent,
  CardComponent,
  LandingHeroComponent,
  type DiscoveryAction,
} from '@optimistic-tanuki/common-ui';

import { PROFILE } from '../profile.data';

@Component({
  selector: 'app-hero',
  imports: [LandingHeroComponent, CardComponent, BadgeComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  readonly profile = PROFILE;

  /**
   * The shared hero renders these as plain anchors. `external` opens the PDF
   * in a new tab, which is how every browser handles an inline PDF anyway.
   */
  readonly primaryAction: DiscoveryAction = {
    label: 'Download résumé (PDF)',
    href: PROFILE.links.resume,
    external: true,
  };

  readonly secondaryAction: DiscoveryAction = {
    label: 'Explore engineering work',
    href: '#work',
  };

  readonly proof = [
    'TypeScript · Angular · NestJS',
    'Linux · Docker · Kubernetes',
    'Go · PostgreSQL · SQLite',
    'Electron · Capacitor · Native integration',
  ];
}
