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

  readonly primaryAction: DiscoveryAction = {
    label: 'View experience',
    href: '#hire',
  };

  readonly secondaryAction: DiscoveryAction = {
    label: 'Start a conversation',
    href: '#contact',
  };

  readonly proof = [
    'Angular · NestJS · TypeScript',
    'Linux · Docker · Kubernetes',
    'Electron · Android · iOS',
    'Go · PostgreSQL · SQLite',
  ];
}
