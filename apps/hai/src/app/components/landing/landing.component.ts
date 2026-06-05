import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import {
  PulseRingsComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';
import { ServicesSectionComponent } from './services-section.component';
import { ManifestoSectionComponent } from './manifesto-section.component';
import { PersonalCloudSectionComponent } from './personal-cloud-section.component';
import { EcosystemSectionComponent } from './ecosystem-section.component';
import { AcronymSectionComponent } from './acronym-section.component';
import { ContactSectionComponent } from './contact-section.component';

@Component({
  selector: 'hai-landing',
  standalone: true,
  imports: [
    CommonModule,
    PulseRingsComponent,
    TopographicDriftComponent,
    ServicesSectionComponent,
    ManifestoSectionComponent,
    PersonalCloudSectionComponent,
    EcosystemSectionComponent,
    AcronymSectionComponent,
    ContactSectionComponent,
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
        'Application delivery for founders and teams that need momentum, clearer systems, and senior implementation help.',
    },
    {
      icon: '\u25C7',
      title: 'Cloud Architecture',
      description:
        'Service boundaries, APIs, delivery pipelines, and production systems designed to stay understandable under load.',
    },
    {
      icon: '\u25CB',
      title: 'Personal Cloud',
      description:
        'Owned compute, self-hosting, backups, and family infrastructure that feels practical instead of experimental.',
    },
  ];

  readonly serviceProof = [
    'Application and platform work shaped around maintainability, not one-off delivery.',
    'Cloud decisions that preserve operational clarity instead of hiding complexity behind tooling.',
    'Personal-cloud systems grounded in backups, local AI, and real household use.',
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

  readonly contactLead = {
    title: 'Start a Project',
    description:
      'Talk to HAI about software delivery, cloud architecture, or a practical personal-cloud system that needs to work in the real world.',
  };

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
