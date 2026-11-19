import { RelatedLink } from '../components/shared/related-links.component';

/**
 * Links from service and process pages to the training and technical support
 * pages. The prompts only point readers to those pages; they promise no
 * handover session, schedule or coverage.
 */

export const TRAINING_LINK: RelatedLink = {
  label: 'Training',
  route: '/training',
};

export const SUPPORT_LINK: RelatedLink = {
  label: 'Technical support',
  route: '/technical-support',
};

export const LEARN_AND_SUPPORT_LINKS: RelatedLink[] = [
  TRAINING_LINK,
  SUPPORT_LINK,
];

export const PRIVATE_CLOUD_RELATED_PROMPT =
  'Want to understand your private cloud, or have help with it later?';

export const HOW_WE_WORK_RELATED_PROMPT =
  'Learning to use it, or help once it is running:';

export const CUSTOM_SOFTWARE_RELATED_PROMPT =
  'Need to learn the tools, or help running them?';

export const SOFTWARE_STACKS_RELATED_PROMPT =
  'Need to learn a stack, or help running one?';

export const APPLIANCES_RELATED_LINKS: RelatedLink[] = [
  { label: 'Training for your team', route: '/training' },
  { label: 'Technical support', route: '/technical-support' },
];

/** Training and technical support point at each other. */
export const TRAINING_SUPPORT_PROMPT = 'Something not working right now?';
export const SUPPORT_TRAINING_PROMPT =
  'Want to understand it well enough to fix it yourself?';
