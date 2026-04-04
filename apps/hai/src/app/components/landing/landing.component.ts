import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import {
  AuroraRibbonComponent,
  PulseRingsComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';

interface EcosystemLink {
  name: string;
  tagline: string;
  href: string;
}

@Component({
  selector: 'hai-landing',
  standalone: true,
  imports: [
    CommonModule,
    AuroraRibbonComponent,
    PulseRingsComponent,
    TopographicDriftComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly ecosystem: EcosystemLink[] = [
    {
      name: 'Digital Grange',
      tagline: 'Digital homesteading for owned and calm computing.',
      href: '/digital-grange',
    },
    {
      name: 'HAI Computer',
      tagline: 'Pre-configured personal cloud and homelab systems.',
      href: '/hai-computer',
    },
    {
      name: 'Towne Square',
      tagline: 'Local commerce and community software.',
      href: '/towne-square',
    },
    {
      name: 'Forge of Will',
      tagline: 'Deliberate systems for productive personal workflows.',
      href: '/forge-of-will',
    },
  ];

  readonly servicePillars = [
    {
      title: 'Software Delivery',
      description:
        'Angular applications, platform workflows, and integration-heavy product work.',
    },
    {
      title: 'Cloud Architecture',
      description:
        'Service boundaries, APIs, delivery pipelines, and operational clarity that hold up in production.',
    },
    {
      title: 'Personal Cloud',
      description:
        'Private compute, self-hosting, backups, and family infrastructure designed for ownership.',
    },
  ];

  readonly ownershipNotes = [
    'Pre-configured systems for homelab, local AI, backups, and family services.',
    'Hosted and personal infrastructure designed to complement each other.',
    'Interfaces and operating patterns shaped for real households, not full-time operators.',
  ];

  get reducedMotion(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    if (typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
