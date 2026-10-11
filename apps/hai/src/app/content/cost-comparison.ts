/**
 * Neutral subscription-vs-owned comparison (S011). Each row gives both
 * sides a fair statement; neither is presented as always better.
 */

export interface ComparisonRow {
  topic: string;
  subscription: string;
  owned: string;
}

export const COST_COMPARISON_HERO = {
  eyebrow: 'Cost comparison',
  title: 'Subscriptions or ownership?',
  summary:
    'Owning your systems is not always cheaper. Here is how the two approaches differ, when a subscription is the better choice, and a calculator for your own numbers.',
  action: { label: 'Start an assessment', route: '/private-cloud/assessment' },
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    topic: 'Up-front cost',
    subscription: 'Little or nothing to start.',
    owned: 'Hardware and setup labor are paid up front.',
  },
  {
    topic: 'Ownership',
    subscription: 'The provider owns the system; you hold an account.',
    owned: 'You own the hardware and the admin accounts on it.',
  },
  {
    topic: 'Licensing',
    subscription:
      'Per-user or per-tier fees, which the provider can raise over time.',
    owned:
      'Open-source software with no license fees. You pay for hardware and labor instead.',
  },
  {
    topic: 'Portability',
    subscription:
      'Export tools vary by provider, and some data or settings may not come with you.',
    owned:
      'Your data stays in open formats on hardware you control, so you can move it or hand it to another provider.',
  },
  {
    topic: 'Control',
    subscription:
      'The provider decides features, price changes, and how data is handled.',
    owned:
      'You decide when to update and who has access, and you carry that responsibility.',
  },
  {
    topic: 'Support',
    subscription: 'Included, usually remote and ticket-based.',
    owned: 'Hourly from a local technician, or a monthly plan of agreed hours.',
  },
  {
    topic: 'Expansion',
    subscription:
      'More seats or storage straight away, at the next price tier.',
    owned:
      'Add drives or services as you need them; a big jump in size can mean new hardware.',
  },
];

export const SUBSCRIPTION_BETTER_WHEN: string[] = [
  'Your needs are small and a free or low-cost plan covers them.',
  'You need a provider-backed uptime guarantee or worldwide availability.',
  'You have no safe space or reliable power for hardware.',
  'You would rather pay a predictable monthly fee than anything up front.',
];
