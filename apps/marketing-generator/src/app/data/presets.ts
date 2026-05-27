import {
  AudiencePersona,
  ChannelType,
  CampaignIntent,
  OfferingPreset,
} from '../types';

export const OFFERING_PRESETS: OfferingPreset[] = [
  {
    id: 'client-interface',
    kind: 'preset-app',
    name: 'Optimistic Tanuki',
    category: 'Community-owned social network',
    summary:
      'The main public app for community-owned networks built around trusted groups, conversations, and shared spaces.',
    differentiators: [
      'Owned community space',
      'Group-first identity',
      'Social tools without generic feed noise',
    ],
    features: [
      'Community feeds',
      'Messages and notifications',
      'Profiles, groups, and forums',
    ],
    audienceHint: 'Organizers, group leaders, and trusted communities',
    positioning:
      'A community-owned social network for groups that want a space shaped by their people instead of public-platform incentives.',
    valueProposition:
      'Give churches, clubs, neighborhoods, and member communities one network for conversation, coordination, and belonging.',
    objectives: [
      'Grow interest in owned and private community networks',
      'Convert organizers and group leaders into signups',
      'Differentiate the app from generic public social media',
    ],
    proofPoints: [
      'Community feeds, forums, messages, and notifications stay in one app',
      'Groups can organize around real members instead of rented audiences',
      'Optimistic Tanuki acts as the de facto main app of the product portfolio',
    ],
    adArchetypes: [
      'owned community network',
      'safer social space',
      'group-led connection',
    ],
  },
  {
    id: 'video-client',
    kind: 'preset-app',
    name: 'Video Client',
    category: 'Streaming platform',
    summary:
      'A YouTube-style video experience with channels, uploads, and watch history.',
    differentiators: [
      'Channel-led discovery',
      'Integrated profiles',
      'Upload-to-watch workflow',
    ],
    features: ['Trending video grid', 'Subscriptions', 'Creator uploads'],
    audienceHint: 'Creators and media teams',
  },
  {
    id: 'store-client',
    kind: 'preset-app',
    name: 'Store Client',
    category: 'Commerce experience',
    summary:
      'A shopper-facing storefront with catalog, cart, bookings, and donation flows.',
    differentiators: [
      'Service and product mix',
      'Booking support',
      'Donation pathways',
    ],
    features: ['Catalog browsing', 'Cart management', 'Checkout-ready flow'],
    audienceHint: 'Shoppers and member communities',
  },
  {
    id: 'fin-commander',
    kind: 'preset-app',
    name: 'Fin Commander',
    category: 'Finance planner',
    summary:
      'A guided planning surface for ledgers, imports, goals, and daily money work.',
    differentiators: [
      'One guided path',
      'Ledger plus planning continuity',
      'Scenario-driven workflow',
    ],
    features: ['Workspace setup', 'Ledger organization', 'Planning views'],
    audienceHint: 'Finance teams and operators',
    positioning:
      'A guided financial workflow for operators who need ledger work, planning, and scenario thinking to stay connected.',
    valueProposition:
      'Move from setup to day-to-day money decisions without losing continuity between ledgers, plans, goals, and imports.',
    objectives: [
      'Communicate guided setup from ledger to plan',
      'Reduce intimidation around financial planning workflows',
      'Position scenarios, goals, and imports as one operational loop',
    ],
    proofPoints: [
      'Ledgers, goals, scenarios, and imports stay in one system',
      'Onboarding and daily money work share one guided path',
      'Operators can move from setup to planning without switching contexts',
    ],
    adArchetypes: [
      'daily money clarity',
      'ledger-to-plan continuity',
      'scenario-ready financial workflow',
    ],
  },
  {
    id: 'system-configurator',
    kind: 'preset-app',
    name: 'System Configurator',
    category: 'Hardware sales flow',
    summary:
      'A guided product configuration experience for compute systems and procurement.',
    differentiators: [
      'Guided build path',
      'Spec-aware selection',
      'Purchase handoff',
    ],
    features: ['Chassis selection', 'Review flow', 'Checkout routing'],
    audienceHint: 'Technical buyers',
  },
  {
    id: 'd6',
    kind: 'preset-app',
    name: 'D6',
    category: 'Wellness workflow',
    summary:
      'A daily-practice application focused on repeatable personal routines and consistency.',
    differentiators: [
      'Routine framing',
      'Low-friction check-ins',
      'Habit visibility',
    ],
    features: ['Daily cycles', 'Guided actions', 'Personal progress'],
    audienceHint: 'Individuals building durable habits',
  },
  {
    id: 'local-hub',
    kind: 'preset-app',
    name: 'Towne Square',
    category: 'Community platform',
    summary:
      'A place-based local coordination app for neighborhoods, communities, classifieds, and nearby participation.',
    differentiators: [
      'Place-based usefulness',
      'Integrated classifieds and messaging',
      'Local trust and relevance',
    ],
    features: [
      'Locality pages',
      'Classifieds and direct messages',
      'Communities and seller tools',
    ],
    audienceHint: 'Community operators',
    positioning:
      'A place-based local network that helps communities coordinate nearby trade, conversation, and civic participation.',
    valueProposition:
      'Give neighborhoods and local groups one practical hub for discovering people, listings, and community activity close to home.',
    objectives: [
      'Increase local participation and classifieds usage',
      'Communicate place-based usefulness quickly',
      'Reinforce trust, neighborhood relevance, and coordination',
    ],
    proofPoints: [
      'City and community pages keep nearby activity discoverable',
      'Classifieds and direct messages stay inside the local context',
      'Towne Square brings trade, participation, and coordination into one hub',
    ],
    adArchetypes: [
      'neighborhood utility',
      'local buy sell trade',
      'civic and community coordination',
    ],
  },
  {
    id: 'forgeofwill',
    kind: 'preset-app',
    name: 'Forge of Will',
    category: 'Execution operating system',
    summary:
      'A focused execution workspace for projects, tasks, notes, journals, risks, and AI-supported decision-making.',
    differentiators: [
      'Context-aware execution',
      'Risk visibility',
      'AI assistance inside workflow',
    ],
    features: [
      'Projects and tasks',
      'Journals, notes, and timers',
      'Risk tracking and AI support',
    ],
    audienceHint: 'Focused operators and small teams',
    positioning:
      'An execution operating system for focused operators and small teams who need plans, work, risk, and context to stay connected.',
    valueProposition:
      'Keep projects, notes, timers, risks, and decisions in one working surface so momentum stays visible enough to finish deliberately.',
    objectives: [
      'Position the app as an execution system instead of another task list',
      'Attract operators who need planning plus follow-through',
      'Emphasize context retention, risk visibility, and disciplined momentum',
    ],
    proofPoints: [
      'Projects, tasks, notes, journals, and risks stay connected',
      'Timers and AI support reinforce execution instead of interrupting it',
      'Teams can review work context before drift becomes rework',
    ],
    adArchetypes: [
      'execution over chaos',
      'operator command center',
      'context-aware project discipline',
    ],
  },
  {
    id: 'leads-app',
    kind: 'preset-app',
    name: 'Leads App',
    category: 'Lead workflow',
    summary: 'An onboarding-driven lead discovery and qualification workspace.',
    differentiators: [
      'Profile-aware onboarding',
      'Discovery signals',
      'Lead qualification support',
    ],
    features: ['Guided setup', 'Lead lists', 'Analytics workspace'],
    audienceHint: 'Sales operators and consultants',
  },
  {
    id: 'web-dev-services',
    kind: 'service',
    name: 'Web Development Services',
    category: 'Engineering offering',
    summary:
      'Pragmatic product, platform, and web delivery for teams that need senior implementation support.',
    differentiators: [
      'Ownership-friendly systems',
      'Hands-on implementation',
      'Clear delivery decisions',
    ],
    features: ['Product builds', 'Platform cleanup', 'Delivery rescue'],
    audienceHint: 'Founder-led teams and organizations',
  },
  {
    id: 'billing-service',
    kind: 'service',
    name: 'Billing Service',
    category: 'Hosted billing infrastructure',
    summary:
      'A managed backend for usage metering, usage blocks, and invoice-preview orchestration with a self-hosted Docker path.',
    differentiators: [
      'Hosted-first adoption',
      'Usage-block accounting',
      'Docker self-host path',
    ],
    features: ['Usage metering', 'Usage blocks', 'Invoice previews'],
    audienceHint: 'Technical buyers and platform teams',
    positioning:
      'A hosted billing backend for teams that need metering, usage-block accounting, and invoice-preview orchestration without custom plumbing.',
    valueProposition:
      'Adopt managed billing infrastructure now while preserving a Docker-based self-hosted path for teams that need it later.',
    objectives: [
      'Position hosted billing as a managed product surface',
      'Show that usage metering and invoice previews can be adopted without bespoke billing infrastructure',
      'Keep the self-hosted Docker option visible for teams with deployment constraints',
    ],
    proofPoints: [
      'Usage metering, usage blocks, and invoice previews stay behind one backend surface',
      'Hosted adoption does not remove the self-hosted Docker path',
      'Technical teams can productize billing workflows without building the billing core from scratch',
    ],
    adArchetypes: [
      'managed billing backend',
      'usage metering without custom plumbing',
      'hosted now self-host later',
    ],
    deliveryModel: 'hybrid',
    pricingModel: 'metered',
    selfHostedNote:
      'Self-hosted Docker containers are available for teams that need their own deployment path.',
  },
  {
    id: 'billing-sdk',
    kind: 'library',
    name: 'Billing SDK',
    category: 'Developer package',
    summary:
      'Free npm package helpers for integrating with the billing service and related usage-accounting workflows.',
    differentiators: [
      'Free package access',
      'Service integration helpers',
      'Mirror-based npm publishing workflow',
    ],
    features: [
      'Client helpers',
      'Typed integration surface',
      'Usage workflow primitives',
    ],
    audienceHint: 'Developers integrating billing flows',
    positioning:
      'A free npm package that shortens the path between application code and hosted or self-hosted billing workflows.',
    valueProposition:
      'Give developers typed helpers and integration primitives without charging for the library surface itself.',
    objectives: [
      'Position the library surface as free to adopt',
      'Make the billing platform easier to integrate from application code',
      'Document mirror-based npm publication as the release path for public packages',
    ],
    proofPoints: [
      'The package is intended to be distributed free through npm',
      'Mirror-repo publishing keeps public package release boundaries explicit',
      'The SDK complements hosted and self-hosted billing deployments instead of replacing them',
    ],
    adArchetypes: [
      'free developer tooling',
      'typed billing integration',
      'mirror-published npm package',
    ],
    deliveryModel: 'npm-package',
    pricingModel: 'free',
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
    profile:
      'Service operators and local businesses competing on trust and clarity.',
    desiredOutcome: 'Turn attention into inquiries and bookings.',
  },
  {
    id: 'finance-teams',
    label: 'Finance Teams',
    profile:
      'Operators who need planning, ledgers, and daily finance work to stay in sync.',
    desiredOutcome: 'Reduce context switching and tighten decisions.',
  },
  {
    id: 'community-operators',
    label: 'Community Operators',
    profile:
      'Groups running member spaces, local hubs, and shared communication surfaces.',
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
