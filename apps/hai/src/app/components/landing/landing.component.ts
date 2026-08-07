import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  PulseRingsComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';
import { ServicesSectionComponent } from './services-section.component';
import { ManifestoSectionComponent } from './manifesto-section.component';
import { PersonalCloudSectionComponent } from './personal-cloud-section.component';
import { EcosystemSectionComponent } from './ecosystem-section.component';
import { ContactSectionComponent } from './contact-section.component';
import { EngagementSectionComponent } from './engagement-section.component';
import { PartnerSectionComponent } from './partner-section.component';

@Component({
  selector: 'hai-landing',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    BadgeComponent,
    PulseRingsComponent,
    TopographicDriftComponent,
    ServicesSectionComponent,
    ManifestoSectionComponent,
    PersonalCloudSectionComponent,
    EcosystemSectionComponent,
    ContactSectionComponent,
    EngagementSectionComponent,
    PartnerSectionComponent,
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
      title: 'Custom Portals & Workflow Automation',
      description:
        'Booking and client portals, invoicing workflows, and client communication tools that fit the way your team works.',
    },
    {
      icon: '\u25C7',
      title: 'Independent Infrastructure',
      description:
        'Lightweight VPS or on-premises environments with backups, security maintenance, and a clear path to client-controlled infrastructure.',
    },
    {
      icon: '\u25CB',
      title: 'Tailored Software',
      description:
        'Task-specific tools, databases, and internal systems built for field-service contractors, professional offices, and growing local businesses.',
    },
  ];

  readonly serviceProof = [
    'Keep your customer records and operational data in systems you can export and move, without swearing off useful cloud tools.',
    'Software documented and scoped so the people who run it, not just the people who built it, can keep it going.',
    'Hosting and hardware costs shown at cost and explained, with no invented packages or guarantees.',
  ];

  readonly ownershipNotes = [
    'Backups and security maintenance for lightweight VPS or on-premises mini-server environments.',
    'Client-direct hardware purchasing or cloud resources passed through at cost.',
    'A practical account and hardware path that keeps infrastructure decisions visible to the client.',
  ];

  readonly manifesto = [
    {
      label: 'Your customer relationships',
      value:
        'Keep the interactions and workflows that make your business yours.',
    },
    {
      label: 'Your operational data',
      value: 'Choose how business information is stored, accessed, and moved.',
    },
    {
      label: 'Your infrastructure choices',
      value:
        'Use cloud, VPS, or on-premises resources without surrendering the decision.',
    },
  ];

  readonly engagementStages = [
    {
      number: '01',
      title: 'Build the foundation',
      items: [
        'Discovery',
        'Architecture',
        'Configuration or customization',
        'Installation as applicable',
      ],
    },
    {
      number: '02',
      title: 'Maintain and improve',
      items: ['Maintenance', 'Security patches', 'Backups', 'Direct support'],
    },
  ];

  readonly partnerBenefits = [
    'White-label delivery for local technology partners',
    'Software engineering and infrastructure support behind your client relationship',
    'Flexible collaboration for MSPs, web agencies, and IT repair shops',
  ];

  readonly contactLead = {
    title: 'Start a Project',
    description:
      'Tell us about a project, an infrastructure need, or a partner delivery conversation.',
  };

  readonly contactSubjects = [
    { value: 'custom-portal', label: 'Custom Portal & Workflow Automation' },
    { value: 'infrastructure', label: 'Independent Infrastructure' },
    { value: 'tailored-software', label: 'Tailored Software' },
    { value: 'partner-inquiry', label: 'Partner Inquiry' },
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
