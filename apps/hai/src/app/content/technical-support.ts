import { PrivateCloudCapability, ProcessStep } from './private-cloud';
import { LABOR_RATE_LABEL } from './pricing';
import { SERVICE_AREA } from './site-content';

/**
 * Copy for /technical-support. Follows C003 (service area), C004 (pricing)
 * and the handoff's "do not promise" list: no response times, 24/7, managed
 * security, data recovery, repair coverage or guaranteed fixes.
 */

export const SUPPORT_CONTACT_ROUTE = '/contact';

export const SUPPORT_HERO = {
  eyebrow: 'Technical support',
  title: 'Technology help without the runaround.',
  summary:
    "When something isn't working, you deserve an explanation you can understand and practical next steps. We help with everyday technology problems, new setups, moving data, and keeping systems usable.",
  action: {
    label: 'Request technical help',
    route: SUPPORT_CONTACT_ROUTE,
    queryParams: { subject: 'technical-support' },
  },
};

export const SUPPORT_AUDIENCES: PrivateCloudCapability[] = [
  {
    title: 'Households and individuals',
    description:
      'A device, account or home network that is not behaving, or a new setup you would rather not do alone.',
  },
  {
    title: 'Small businesses',
    description:
      'Workstations, shared files and the everyday tools your team relies on.',
  },
  {
    title: 'Nonprofits and faith groups',
    description:
      'Practical help for offices and volunteers, without needing to know the technical terms.',
  },
];

export const SUPPORT_SERVICES: PrivateCloudCapability[] = [
  {
    title: 'Troubleshooting and setup',
    description:
      'Devices, connectivity, accounts and commonly used software, subject to the platforms we can actually support.',
  },
  {
    title: 'Files, backups and migration',
    description:
      'Moving information safely, checking backup plans, and preparing new or replacement systems.',
  },
  {
    title: 'Business and organization help',
    description:
      'Workstations, basic shared tools and workflows, and coordinating more specialized support as needed.',
  },
  {
    title: 'Ongoing care',
    description:
      'Maintenance and support arrangements, only when separately agreed and something we can actually deliver.',
  },
];

export const SUPPORT_STEPS: ProcessStep[] = [
  {
    title: 'Describe the problem',
    description: 'Tell us what is happening, in your own words.',
  },
  {
    title: 'Confirm the scope',
    description:
      'We work out what is involved and whether it can be done remotely or needs a visit.',
  },
  {
    title: 'Agree charges and next steps',
    description: 'You hear what the work is likely to cost before it starts.',
  },
  {
    title: 'Do the agreed work',
    description: 'We carry out the work we agreed, and nothing beyond it.',
  },
  {
    title: 'Explain what was done',
    description:
      'You get a plain explanation of what we did and how to avoid the same problem again.',
  },
];

export const SUPPORT_BOUNDARY_HEADING = 'What we will and will not promise.';

export const SUPPORT_BOUNDARY: PrivateCloudCapability[] = [
  {
    title: 'Agreed before we start',
    description:
      'We confirm scope, availability and pricing before work begins.',
  },
  {
    title: 'Not everything is remote',
    description:
      'Not every repair, device or emergency can be handled remotely.',
  },
  {
    title: 'No guaranteed outcomes',
    description:
      'We do not promise same-day or around-the-clock help, unlimited support, or that every problem can be fixed. Data recovery, managed security and device repair are not part of this service unless we confirm them with you first.',
  },
];

export const SUPPORT_PRICING_HEADING = 'How support is priced.';

export const SUPPORT_PRICING: PrivateCloudCapability[] = [
  {
    title: 'Labor',
    description: `Support labor is ${LABOR_RATE_LABEL}. We estimate the hours with you before any work starts.`,
  },
  {
    title: 'Parts and services',
    description:
      'Hardware and outside services are passed through at the actual amount, listed separately from labor.',
  },
];

export const SUPPORT_AREA_HEADING = 'Where we work.';

export const SUPPORT_AREA: PrivateCloudCapability[] = [
  {
    title: 'Service area',
    description: SERVICE_AREA,
  },
];

export const SUPPORT_CTA = {
  title: 'Tell us what is not working.',
  text: 'Describe the problem and we will reply with what we need to know next. There is no obligation.',
  action: SUPPORT_HERO.action,
};
