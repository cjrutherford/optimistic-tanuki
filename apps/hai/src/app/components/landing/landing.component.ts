import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  HaiAppDirectoryService,
  HaiExpansionComponent,
} from '@optimistic-tanuki/hai-ui';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
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
    ContactFormComponent,
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
  private readonly http = inject(HttpClient);

  readonly ecosystem$ = this.appDirectory.getResolvedApps('hai');
  submittingContact = false;
  contactStatus: string | null = null;

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

  readonly contactSubjects = [
    { value: 'software-delivery', label: 'Software Delivery' },
    { value: 'cloud-architecture', label: 'Cloud Architecture' },
    { value: 'personal-cloud', label: 'Personal Cloud' },
    { value: 'general', label: 'General Inquiry' },
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

  submitContactForm(event: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    this.submittingContact = true;
    this.contactStatus = null;

    this.http
      .post('/api/contact', {
        ...event,
        appScope: 'hai',
        sourcePage: '/#contact',
        sourceLabel: 'HAI',
      })
      .subscribe({
        next: () => {
          this.submittingContact = false;
          this.contactStatus = 'Message received. We will follow up shortly.';
        },
        error: () => {
          this.submittingContact = false;
          this.contactStatus =
            'Unable to submit the message right now. Please try again shortly.';
        },
      });
  }
}
