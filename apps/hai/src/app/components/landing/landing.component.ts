import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import {
  HaiAppDirectoryService,
  HaiExpansionComponent,
} from '@optimistic-tanuki/hai-ui';
import {
  AuroraRibbonComponent,
  PulseRingsComponent,
  ShimmerBeamComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'hai-landing',
  standalone: true,
  imports: [
    CommonModule,
    HaiExpansionComponent,
    AuroraRibbonComponent,
    PulseRingsComponent,
    ShimmerBeamComponent,
    TopographicDriftComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appDirectory = inject(HaiAppDirectoryService);

  readonly ecosystem$ = this.appDirectory.getResolvedApps('hai');

  readonly servicePillars = [
    {
      icon: '\u25B3',
      title: 'Software Delivery',
      description:
        'Angular applications, platform workflows, and integration-heavy product work.',
    },
    {
      icon: '\u25C7',
      title: 'Cloud Architecture',
      description:
        'Service boundaries, APIs, delivery pipelines, and operational clarity that hold up in production.',
    },
    {
      icon: '\u25CB',
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

  readonly manifesto = [
    {
      label: 'Own the stack',
      value: 'Software that can live in the cloud, at home, or both.',
    },
    {
      label: 'Keep it legible',
      value:
        'Interfaces and operations that feel understandable under pressure.',
    },
    {
      label: 'Build for staying power',
      value: 'Tools, systems, and hardware configured to endure.',
    },
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
