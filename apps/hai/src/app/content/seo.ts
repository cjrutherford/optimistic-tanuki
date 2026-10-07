import { CONTACT_DETAILS } from './contact-details';

/** Page metadata for every route (S015). Canonical host is the live domain. */

export const SITE_ORIGIN = 'https://hopefulaspirationsindustries.com';
export const SITE_NAME = 'Hopeful Aspirations Industries';
/** Interim social preview, cropped from the contact photo; replace with a 1200×630 card. */
export const SOCIAL_IMAGE = {
  path: '/assets/social-card.jpg',
  width: 928,
  height: 486,
  alt: 'A small office shelf with a compact server, a two-drive storage enclosure, and a router.',
};

export interface PageSeo {
  title: string;
  description: string;
}

/** Keyed by route path without the leading slash ('' is the homepage). */
export const PAGE_SEO: Record<string, PageSeo> = {
  '': {
    title: 'Hopeful Aspirations Industries | Technology You Own',
    description:
      'Private cloud systems, turn-key server appliances, open-source software, and custom tools for homes, organizations, and businesses in Savannah and South Georgia.',
  },
  'private-cloud': {
    title: 'Private Cloud Systems | Hopeful Aspirations Industries',
    description:
      'A cloud you control: files, photos, media, and backups on hardware you own, set up and supported by real people nearby, with no vendor lock-in.',
  },
  'private-cloud/home': {
    title: 'Private Cloud for Home, Photos & Media | HAI',
    description:
      'Photos, files, media, and backups for your household, set up for you on hardware you own and supported by real people in South Georgia.',
  },
  'private-cloud/organizations': {
    title:
      'Private Cloud for Small Businesses, Nonprofits & Faith Groups | HAI',
    description:
      'Shared files, secure backups, and local support without vendor lock-in, for faith groups, nonprofits, community groups, and small businesses.',
  },
  'private-cloud/open-source-stack': {
    title: 'Open-Source Private Cloud Stack | HAI',
    description:
      'The open-source projects a private cloud is built from, including Nextcloud, Immich, Jellyfin, Paperless-ngx, and Vaultwarden. The exact stack depends on what you need.',
  },
  'private-cloud/assessment': {
    title: 'Private Cloud Assessment | HAI',
    description:
      'Answer a few questions about what you store and who uses it, and get an itemized quote: hardware at actual cost plus labor. No obligation.',
  },
  'turn-key-appliances': {
    title: 'Turn-key Server Appliances | HAI',
    description:
      'Pre-configured on-premises server appliances for offices and homes. Hardware at actual cost with no markup, labor at a published hourly rate.',
  },
  'software-stacks': {
    title: 'Industry Software Stacks | HAI',
    description:
      'Dedicated hardware paired with custom and vetted open-source software for regional trades and professional offices, plus a private cloud stack.',
  },
  'cost-comparison': {
    title: 'Subscriptions or Ownership? Cost Comparison | HAI',
    description:
      'A balanced comparison of cloud subscriptions and owning your systems, with a five-year calculator for the numbers from your own quote.',
  },
  'custom-software': {
    title: 'Custom Software & Workflow Automation | HAI',
    description:
      'Client portals, workflow automation, and task-specific tools for when off-the-shelf software falls short, documented so your team can keep it running.',
  },
  partners: {
    title: 'White-Label Delivery for Local IT Partners | HAI',
    description:
      'Software engineering and infrastructure support behind your client relationship, for MSPs, web agencies, and IT repair shops.',
  },
  'how-we-work': {
    title: 'How We Work | HAI',
    description:
      'Discovery, architecture, installation, then maintenance, security patches, backups, and direct support from the people who set it up.',
  },
  contact: {
    title: 'Contact | Hopeful Aspirations Industries',
    description: `Tell us about a project or an infrastructure need. Call ${CONTACT_DETAILS.phone} or send a message.`,
  },
};

/** The business, as structured data on every page. */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  alternateName: 'HAI',
  url: `${SITE_ORIGIN}/`,
  telephone: `+1-${CONTACT_DETAILS.phone}`,
  email: CONTACT_DETAILS.email,
  areaServed: [
    { '@type': 'City', name: 'Savannah, Georgia' },
    { '@type': 'AdministrativeArea', name: 'South Georgia' },
  ],
  knowsAbout: [
    'Private cloud',
    'On-premises servers',
    'Open-source software',
    'Custom software',
  ],
};

/** The private-cloud service, as structured data on its pages. */
export const PRIVATE_CLOUD_SERVICE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Private cloud systems',
  serviceType: 'Private cloud installation and support',
  provider: { '@id': `${SITE_ORIGIN}/#organization` },
  areaServed: ORGANIZATION_SCHEMA.areaServed,
  audience: [
    { '@type': 'Audience', audienceType: 'Households' },
    {
      '@type': 'Audience',
      audienceType:
        'Faith groups, nonprofits, community groups, and small businesses',
    },
  ],
  url: `${SITE_ORIGIN}/private-cloud`,
};
