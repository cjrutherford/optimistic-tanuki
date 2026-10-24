/**
 * Copy shared by the homepage and the offering pages, so a section reads the
 * same wherever it is rendered.
 */

export interface ServicePillar {
  icon: string;
  title: string;
  description: string;
}

export interface ManifestoEntry {
  label: string;
  value: string;
}

export interface EngagementStage {
  number: string;
  title: string;
  items: string[];
}

export interface ContactSubject {
  value: string;
  label: string;
}

export const SERVICE_PILLARS: ServicePillar[] = [
  {
    icon: '△',
    title: 'Custom Portals & Workflow Automation',
    description:
      'Booking and client portals, invoicing workflows, and client communication tools that fit the way your team works.',
  },
  {
    icon: '◇',
    title: 'Independent Infrastructure',
    description:
      'Lightweight VPS or on-premises environments with backups, security maintenance, and a clear path to client-controlled infrastructure.',
  },
  {
    icon: '○',
    title: 'Tailored Software',
    description:
      'Task-specific tools, databases, and internal systems built for field-service contractors, professional offices, and growing local businesses.',
  },
];

export const SERVICE_PROOF: string[] = [
  'Keep your customer records and operational data in systems you can export and move, without swearing off useful cloud tools.',
  'Software documented and scoped so the people who run it, not just the people who built it, can keep it going.',
  'Hosting and hardware costs shown at cost and explained, with no invented packages or guarantees.',
];

export const OWNERSHIP_NOTES: string[] = [
  'Backups and security maintenance for lightweight VPS or on-premises mini-server environments.',
  'Client-direct hardware purchasing or cloud resources passed through at cost.',
  'A practical account and hardware path that keeps infrastructure decisions visible to the client.',
];

export const MANIFESTO: ManifestoEntry[] = [
  {
    label: 'Your customer relationships',
    value: 'Keep the interactions and workflows that make your business yours.',
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

export const ENGAGEMENT_STAGES: EngagementStage[] = [
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

export const PARTNER_BENEFITS: string[] = [
  'White-label delivery for local technology partners',
  'Software engineering and infrastructure support behind your client relationship',
  'Flexible collaboration for MSPs, web agencies, and IT repair shops',
];

export const CONTACT_LEAD = {
  title: 'Start a Project',
  description:
    'Tell us about a project, an infrastructure need, or a partner delivery conversation.',
} as const;

export const CONTACT_SUBJECTS: ContactSubject[] = [
  { value: 'custom-portal', label: 'Custom Portal & Workflow Automation' },
  { value: 'infrastructure', label: 'Independent Infrastructure' },
  { value: 'tailored-software', label: 'Tailored Software' },
  { value: 'partner-inquiry', label: 'Partner Inquiry' },
  { value: 'technical-training', label: 'Technical Training' },
  { value: 'web-design', label: 'Web Design' },
  {
    value: 'hardware-support-and-repair',
    label: 'Hardware Support and Repair',
  },
  { value: 'partnerships', label: 'Partnership Opportunities' },
];

export interface Offering {
  name: string;
  headline: string;
  summary: string;
  route: string;
  linkLabel: string;
}

/** One card per offering on the homepage; the detail lives on each route. */
export const OFFERINGS: Offering[] = [
  {
    name: 'Private Cloud',
    headline: 'Your files, on your hardware.',
    summary:
      'Files, photos, media, and backups on hardware you own, set up and supported by people you can call.',
    route: '/private-cloud',
    linkLabel: 'Explore private cloud',
  },
  {
    name: 'Turn-key Appliances',
    headline: 'Servers that stay in your office.',
    summary:
      'Pre-configured on-premises server appliances, with hardware at cost and leasing on request.',
    route: '/turn-key-appliances',
    linkLabel: 'See the appliances',
  },
  {
    name: 'Software Stacks',
    headline: 'Tools matched to your trade.',
    summary:
      'Dedicated hardware paired with custom and vetted open-source software for regional industries.',
    route: '/software-stacks',
    linkLabel: 'Browse the stacks',
  },
  {
    name: 'Custom Software',
    headline: 'Software built around your work.',
    summary:
      'Client portals, workflow automation, and task-specific tools for when off-the-shelf software falls short.',
    route: '/custom-software',
    linkLabel: 'Explore custom software',
  },
  {
    name: 'Support & Migration',
    headline: "Help that doesn't end at install.",
    summary:
      'Migration, maintenance, security patches, and backups, with direct support from the people who set it up.',
    route: '/how-we-work',
    linkLabel: 'See how we work',
  },
  {
    name: 'Partners',
    headline: 'Capacity for local IT shops.',
    summary:
      'White-label software and infrastructure delivery behind your client relationship.',
    route: '/partners',
    linkLabel: 'Partner with us',
  },
  {
    name: 'Technical Training',
    headline: 'Learn from the experts.',
    summary:
      'Hands-on workshops, tutorials, and guidance to help you make the most of your infrastructure and software.',
    route: '/technical-training',
    linkLabel: 'Explore technical training',
  },
  {
    name: 'Web Design',
    headline: 'Crafting beautiful websites.',
    summary:
      'Design and development services to create visually appealing and user-friendly websites.',
    route: '/web-design',
    linkLabel: 'Explore web design',
  },
  {
    name: 'Hardware Support and Repair',
    headline: 'Keeping your hardware running smoothly.',
    summary:
      'On-site and remote support for hardware issues, repairs, and maintenance.',
    route: '/hardware-support-and-repair',
    linkLabel: 'Get hardware support',
  },
];

export interface Capability {
  title: string;
  description: string;
}

export interface PrivateCloudPath {
  label: string;
  description: string;
  route: string;
}

/** Homepage private-cloud introduction; the detail lives on /private-cloud. */
export const PRIVATE_CLOUD_INTRO = {
  headline: 'A cloud you control.',
  summary:
    'Your own cloud on hardware you own, built from mature open-source software and supported by people nearby.',
} as const;

export const PRIVATE_CLOUD_CAPABILITIES: Capability[] = [
  {
    title: 'Files and photos',
    description:
      'Shared files, photo collections, and documents kept on hardware you own.',
  },
  {
    title: 'Media and backups',
    description:
      'Home media libraries and scheduled backups, set up and checked for you.',
  },
  {
    title: 'Support without lock-in',
    description:
      'Installed and supported by real people, on open-source software you can take with you.',
  },
];

export const PRIVATE_CLOUD_PATHS: PrivateCloudPath[] = [
  {
    label: 'For your home',
    description: 'Photos, files, media, and backups.',
    route: '/private-cloud/home',
  },
  {
    label: 'For organizations',
    description:
      'Faith groups, nonprofits, community groups, and small businesses.',
    route: '/private-cloud/organizations',
  },
];
