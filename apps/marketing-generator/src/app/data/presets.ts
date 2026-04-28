import {
  AudiencePersona,
  ChannelType,
  CampaignIntent,
  OfferingPreset,
} from '../types';

export const OFFERING_PRESETS: OfferingPreset[] = [
  {
    id: 'video-client',
    kind: 'preset-app',
    name: 'Video Client',
    category: 'Streaming platform',
    summary: 'A YouTube-style video experience with channels, uploads, and watch history.',
    differentiators: ['Channel-led discovery', 'Integrated profiles', 'Upload-to-watch workflow'],
    features: ['Trending video grid', 'Subscriptions', 'Creator uploads'],
    audienceHint: 'Creators and media teams',
  },
  {
    id: 'store-client',
    kind: 'preset-app',
    name: 'Store Client',
    category: 'Commerce experience',
    summary: 'A shopper-facing storefront with catalog, cart, bookings, and donation flows.',
    differentiators: ['Service and product mix', 'Booking support', 'Donation pathways'],
    features: ['Catalog browsing', 'Cart management', 'Checkout-ready flow'],
    audienceHint: 'Shoppers and member communities',
  },
  {
    id: 'fin-commander',
    kind: 'preset-app',
    name: 'Fin Commander',
    category: 'Finance planner',
    summary: 'A guided planning surface for ledgers, imports, goals, and daily money work.',
    differentiators: ['One guided path', 'Ledger plus planning continuity', 'Scenario-driven workflow'],
    features: ['Workspace setup', 'Ledger organization', 'Planning views'],
    audienceHint: 'Finance teams and operators',
  },
  {
    id: 'system-configurator',
    kind: 'preset-app',
    name: 'System Configurator',
    category: 'Hardware sales flow',
    summary: 'A guided product configuration experience for compute systems and procurement.',
    differentiators: ['Guided build path', 'Spec-aware selection', 'Purchase handoff'],
    features: ['Chassis selection', 'Review flow', 'Checkout routing'],
    audienceHint: 'Technical buyers',
  },
  {
    id: 'd6',
    kind: 'preset-app',
    name: 'D6',
    category: 'Wellness workflow',
    summary: 'A daily-practice application focused on repeatable personal routines and consistency.',
    differentiators: ['Routine framing', 'Low-friction check-ins', 'Habit visibility'],
    features: ['Daily cycles', 'Guided actions', 'Personal progress'],
    audienceHint: 'Individuals building durable habits',
  },
  {
    id: 'local-hub',
    kind: 'preset-app',
    name: 'Local Hub',
    category: 'Community platform',
    summary: 'A local-first community interface for groups that need content, coordination, and social presence.',
    differentiators: ['Community ownership', 'Integrated social surface', 'Local relevance'],
    features: ['Activity feeds', 'Community pages', 'Shared updates'],
    audienceHint: 'Community operators',
  },
  {
    id: 'leads-app',
    kind: 'preset-app',
    name: 'Leads App',
    category: 'Lead workflow',
    summary: 'An onboarding-driven lead discovery and qualification workspace.',
    differentiators: ['Profile-aware onboarding', 'Discovery signals', 'Lead qualification support'],
    features: ['Guided setup', 'Lead lists', 'Analytics workspace'],
    audienceHint: 'Sales operators and consultants',
  },
  {
    id: 'web-dev-services',
    kind: 'service',
    name: 'Web Development Services',
    category: 'Engineering offering',
    summary: 'Pragmatic product, platform, and web delivery for teams that need senior implementation support.',
    differentiators: ['Ownership-friendly systems', 'Hands-on implementation', 'Clear delivery decisions'],
    features: ['Product builds', 'Platform cleanup', 'Delivery rescue'],
    audienceHint: 'Founder-led teams and organizations',
  },
];

export const AUDIENCE_PERSONAS: AudiencePersona[] = [
  {
    id: 'creators',
    label: 'Creators',
    profile: 'Independent creators and small media teams.',
    desiredOutcome: 'Publish faster and grow audience loyalty.',
  },
  {
    id: 'local-businesses',
    label: 'Local Businesses',
    profile: 'Service operators and local businesses competing on trust and clarity.',
    desiredOutcome: 'Turn attention into inquiries and bookings.',
  },
  {
    id: 'finance-teams',
    label: 'Finance Teams',
    profile: 'Operators who need planning, ledgers, and daily finance work to stay in sync.',
    desiredOutcome: 'Reduce context switching and tighten decisions.',
  },
  {
    id: 'community-operators',
    label: 'Community Operators',
    profile: 'Groups running member spaces, local hubs, and shared communication surfaces.',
    desiredOutcome: 'Increase participation and reinforce belonging.',
  },
  {
    id: 'shoppers',
    label: 'Shoppers',
    profile: 'End users comparing products, services, and purchase paths.',
    desiredOutcome: 'Understand the offer quickly and buy with confidence.',
  },
  {
    id: 'technical-buyers',
    label: 'Technical Buyers',
    profile: 'Leads evaluating systems, platforms, or implementation partners.',
    desiredOutcome: 'See operational fit before committing time or budget.',
  },
];

export const CAMPAIGN_INTENT_LABELS: Record<CampaignIntent, string> = {
  awareness: 'Awareness',
  conversion: 'Conversion',
  launch: 'Launch',
};

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  web: 'Web landing concept',
  email: 'Email campaign concept',
  social: 'Social campaign concept',
};
