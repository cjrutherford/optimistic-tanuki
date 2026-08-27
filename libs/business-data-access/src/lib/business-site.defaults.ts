import { BusinessSiteConfig } from './business-site.types';

export const DEFAULT_BUSINESS_SITE_CONFIG: BusinessSiteConfig = {
  businessType: 'general',
  site: {
    slug: 'my-business',
    ownerProfileId: '',
    ownerUserId: '',
    status: 'draft',
    onboardingCompletedAt: '',
  },
  leadContext: {
    profileId: '',
    appScope: 'business-site',
  },
  brand: {
    businessName: 'My Business',
    monogram: 'MB',
    ownerName: 'Business Owner',
    tagline: 'Professional services for your needs.',
    intro: 'Quality service built around your goals.',
    longBio: 'We provide professional services tailored to your unique needs.',
    credentials: [],
    specializations: [],
  },
  contact: {
    email: 'hello@business.local',
    phone: '(555) 000-0000',
    location: 'By appointment.',
    consultationLabel: 'Book a consultation',
  },
  features: {
    store: { enabled: false },
    booking: { enabled: true, allowOnlinePayment: false },
    clientTasks: { enabled: false, allowClientCompletion: false },
    clientPortal: { enabled: true },
    invoices: { enabled: false },
    testimonials: { enabled: true },
  },
  serviceCatalog: {
    source: 'manual',
  },
  services: [],
  landingPage: {
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: 'Welcome',
        enabled: true,
        order: 0,
        layoutPlacement: { split: 'primary', grid: 'hero-wide' },
      },
      {
        id: 'about',
        type: 'about',
        title: 'About',
        enabled: true,
        order: 1,
        layoutPlacement: { split: 'primary', grid: 'top-left' },
      },
      {
        id: 'services',
        type: 'services',
        title: 'Services',
        enabled: false,
        order: 2,
        layoutPlacement: { split: 'primary', grid: 'top-right' },
      },
      {
        id: 'testimonials',
        type: 'testimonials',
        title: 'Testimonials',
        enabled: true,
        order: 3,
        layoutPlacement: { split: 'secondary', grid: 'bottom-left' },
      },
      {
        id: 'contact',
        type: 'contact',
        title: 'Contact',
        enabled: true,
        order: 4,
        layoutPlacement: { split: 'secondary', grid: 'bottom-right' },
      },
      {
        id: 'booking',
        type: 'booking',
        title: 'Book Now',
        enabled: true,
        order: 5,
        layoutPlacement: { split: 'secondary', grid: 'bottom-right' },
      },
    ],
    layout: 'single-column',
  },
  clientPortal: {
    headline: 'The client portal keeps your plan and progress in one place.',
    description:
      'Clients can review sessions, follow instructions, submit updates, and stay current on billing.',
    capabilities: [
      'View upcoming sessions and history',
      'Follow assigned instructions',
      'Submit progress updates',
      'Track invoices and packages',
    ],
  },
  testimonials: [],
  theme: {
    mode: 'light',
    personalityId: 'professional',
    primaryColor: '#1f7a63',
  },
};
