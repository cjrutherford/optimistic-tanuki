import { PrivateCloudCapability } from './private-cloud';
import { SERVICE_AREA } from './site-content';

/**
 * Copy for /training. Follows C004 (training is quoted before work begins and
 * states no price) and C005 (one-on-one is available now; group sessions and
 * online resources are planned and unlinked). No schedules, recorded classes,
 * purchasable courses or certificates.
 */

export const TRAINING_CONTACT_ROUTE = '/contact';

export const TRAINING_HERO = {
  eyebrow: 'Training',
  title: 'Learn technology with confidence.',
  summary:
    "You don't need to know the technical terms to ask a good question. Whether you're learning basic digital skills, trying to make technology work for your organization, or exploring greater control over your own devices and data, we'll help you build understanding step by step.",
  action: {
    label: 'Ask about a lesson or workshop',
    route: TRAINING_CONTACT_ROUTE,
    queryParams: { subject: 'training' },
  },
};

export const TRAINING_AUDIENCES: PrivateCloudCapability[] = [
  {
    title: "I'm just getting started",
    description:
      'Start from wherever you are. No question is too basic, and nobody will rush you.',
  },
  {
    title: 'I want to use technology for my work or community',
    description:
      'Make everyday tools work for your business, nonprofit, faith group or neighborhood.',
  },
  {
    title: 'I want to understand and manage more myself',
    description:
      'Learn how your devices and data work so you can decide how much to take into your own hands.',
  },
];

/** Status labels (C005). Planned modes are shown but never linked. */
export const TRAINING_MODES: PrivateCloudCapability[] = [
  {
    title: 'One-on-one guidance',
    description:
      'Available now. Personal instruction at your pace, on your own devices.',
  },
  {
    title: 'Small-group and community instruction',
    description: 'Planned. Not yet scheduled.',
  },
  {
    title: 'Accessible online resources',
    description: 'Planned. Nothing is published yet.',
  },
];

export const TRAINING_TOPICS: PrivateCloudCapability[] = [
  {
    title: 'Technology Without Fear',
    description:
      'Basic devices, files and accounts, safe browsing, passwords, online safety, and the basics of AI.',
  },
  {
    title: 'Technology for Your Aspirations',
    description:
      'Websites, shared documents, productive workflows, records, collaboration, and understanding your technology choices.',
  },
  {
    title: 'Take Control of Your Technology',
    description:
      'Backups, privacy, local versus cloud, Linux fundamentals, self-hosting, and private cloud.',
  },
];

export const TRAINING_PHILOSOPHY_HEADING = 'Learning, not lock-in.';

export const TRAINING_PHILOSOPHY: PrivateCloudCapability[] = [
  {
    title: 'You decide',
    description:
      'Learn to do it yourself if that is what you want. You are never expected to buy a managed service in order to learn.',
  },
  {
    title: 'Pricing',
    description:
      'Personal instruction is paid and is quoted before work begins. Free self-help resources are planned, and we do not want basic guidance to sit behind a sales inquiry.',
  },
];

export const TRAINING_AREA_HEADING = 'Where we teach.';

export const TRAINING_AREA: PrivateCloudCapability[] = [
  {
    title: 'Service area',
    description: SERVICE_AREA,
  },
];

export const TRAINING_CTA = {
  title: 'Tell us what you want to learn.',
  text: 'Describe what you would like to understand, and we will suggest a sensible next step. There is no obligation.',
  action: TRAINING_HERO.action,
};
