/**
 * Copy for /private-cloud. Messaging follows
 * docs/plans/hai-private-cloud/04-CONTENT-AND-MESSAGING.md.
 */

export interface PrivateCloudCapability {
  title: string;
  description: string;
}

export interface AudiencePath {
  eyebrow: string;
  title: string;
  message: string;
  audiences: string[];
  route?: string;
  linkLabel?: string;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export const ASSESSMENT_ROUTE = '/private-cloud/assessment';

export const PRIVATE_CLOUD_HERO = {
  eyebrow: 'Private cloud',
  title: 'A cloud you control.',
  summary:
    'Your files, photos, media, and backups on hardware you own, set up and supported by real people nearby.',
  action: { label: 'Start an assessment', route: ASSESSMENT_ROUTE },
};

export const PRIVATE_CLOUD_CAPABILITY_LIST: PrivateCloudCapability[] = [
  {
    title: 'Files and sharing',
    description:
      'Shared folders and documents your household or team can reach from their own devices.',
  },
  {
    title: 'Photos',
    description:
      'Large photo collections in one place, organized and backed up.',
  },
  {
    title: 'Media',
    description:
      'Movies, music, and home video played on the screens you already have.',
  },
  {
    title: 'Documents and passwords',
    description:
      'Scanned paperwork kept searchable, and a shared password manager for the people you choose.',
  },
  {
    title: 'Backups',
    description:
      'Scheduled backups with health checks, so problems are found early.',
  },
  {
    title: 'Remote access',
    description:
      'Reach your cloud away from home or the office over a private, encrypted connection.',
  },
];

export const CAPABILITY_QUALIFIER =
  'Every setup is different. We recommend only the services you need; nobody gets everything by default.';

export const AUDIENCE_PATHS: AudiencePath[] = [
  {
    eyebrow: 'Home',
    title: 'For your home',
    message:
      'Photos, files, media, and backups — set up for you and supported by real people.',
    audiences: [
      'Families',
      'Home media libraries',
      'Shared household files',
      'Large photo collections',
    ],
    route: '/private-cloud/home',
    linkLabel: 'Private cloud for your home',
  },
  {
    eyebrow: 'Organizations',
    title: 'For organizations',
    message:
      'Shared files, secure backups, and local support — without vendor lock-in.',
    audiences: [
      'Faith groups',
      'Nonprofits',
      'Community groups',
      'Small businesses',
    ],
    route: '/private-cloud/organizations',
    linkLabel: 'Private cloud for organizations',
  },
];

export const FREEDOM_PRINCIPLE =
  'You should be able to leave any vendor, including us, with your data intact.';

export const FREEDOM_COMMITMENTS: string[] = [
  'Built on open-source software, so your data stays in formats other tools can read.',
  'Accounts and admin access in your name, not ours.',
  'Documentation handed over, so another qualified provider can take over.',
];

export const PRIVATE_CLOUD_STEPS: ProcessStep[] = [
  {
    title: 'Assessment',
    description:
      'Tell us what you store, who uses it, and what you pay for today.',
  },
  {
    title: 'Plan',
    description:
      'We recommend hardware and services, with the costs written down up front.',
  },
  {
    title: 'Install and migrate',
    description:
      'We set everything up and move your existing files and photos across.',
  },
  {
    title: 'Support',
    description:
      'Updates, backups, and monitoring, with real people to call when you need help.',
  },
];

export interface ArchitectureTier {
  label: string;
  items: string[];
}

export const HOME_HERO = {
  eyebrow: 'Private cloud for your home',
  title: 'Photos, files, media, and backups — set up for you.',
  summary:
    "Everything your household keeps, on hardware you own and supported by real people nearby. You don't need to be technical.",
  action: { label: 'Start an assessment', route: ASSESSMENT_ROUTE },
};

export const HOME_OUTCOMES: PrivateCloudCapability[] = [
  {
    title: 'Room for everything',
    description:
      "Space for the whole household's files, sized for what you have today with room to grow.",
  },
  {
    title: 'Every photo in one place',
    description:
      'Phones, cameras, and old drives gathered into one library, organized by date and backed up.',
  },
  {
    title: 'Your own media library',
    description:
      'Your movies, shows, and music on the TVs, tablets, and phones you already own.',
  },
  {
    title: 'Reach it away from home',
    description:
      'Get to your files and photos from anywhere over a private, encrypted connection.',
  },
  {
    title: 'Backups you never think about',
    description:
      'Scheduled backups with health checks, so problems are found early.',
  },
  {
    title: 'A space for each person',
    description:
      'Separate accounts for everyone in the house, with shared folders for the things you share.',
  },
];

export const HOME_USE_CASES: PrivateCloudCapability[] = [
  {
    title: '“My phone is full again.”',
    description:
      'Photos copy from phones into your own library, so phone storage stops running out.',
  },
  {
    title: '“Our files are in four different places.”',
    description:
      'Files spread across storage plans, laptops, and USB drives come together in one place you own.',
  },
  {
    title: '“The family photos are on an old laptop.”',
    description:
      'Old computers and drives are gathered into one backed-up library before they fail.',
  },
];

export const HOME_ARCHITECTURE: ArchitectureTier[] = [
  {
    label: 'Your devices',
    items: ['Phones and tablets', 'Laptops', 'TVs and streaming boxes'],
  },
  {
    label: 'Your home network',
    items: [
      'The router and Wi-Fi you already have',
      'Private, encrypted access when you are away',
    ],
  },
  {
    label: 'Your private cloud',
    items: [
      'A small, quiet server in your home',
      'Files, photos, media, and backups',
      'Storage drives with health checks',
    ],
  },
  {
    label: 'A second copy',
    items: ['Scheduled backups to a separate drive or a location you choose'],
  },
];

export const HOME_ARCHITECTURE_CAPTION =
  'An example home setup. What you get depends on what you store and how your household uses it.';

export const ORGANIZATION_HERO = {
  eyebrow: 'Private cloud for organizations',
  title: 'Shared files, secure backups, and local support.',
  summary:
    'Without vendor lock-in. For faith groups, nonprofits, community groups, and small businesses that want their records on systems they control.',
  action: { label: 'Start an assessment', route: ASSESSMENT_ROUTE },
};

export const ORGANIZATION_AUDIENCES: PrivateCloudCapability[] = [
  {
    title: 'Faith groups',
    description:
      'Member lists, event files, and recordings kept in one place your volunteers can reach.',
  },
  {
    title: 'Nonprofits',
    description:
      'Grant documents, donor records, and program files on systems the organization owns.',
  },
  {
    title: 'Community groups',
    description:
      'Shared files and calendars for volunteers who change from year to year, with access you can hand over.',
  },
  {
    title: 'Small businesses',
    description:
      'Client files, shared drives, and backups for small offices that want local, accountable support.',
  },
];

export const ORGANIZATION_OUTCOMES: PrivateCloudCapability[] = [
  {
    title: 'Shared files',
    description:
      'Shared folders with permissions per person or team, reachable from the office, from home, or on a phone.',
  },
  {
    title: 'Reliable backups',
    description:
      'Scheduled, monitored backups, with a second copy kept apart from the main system.',
  },
  {
    title: 'Setup and support',
    description:
      'We install it, move your existing files, show your people how to use it, and stay your local contact for updates and fixes.',
  },
];

export const ORGANIZATION_QUESTIONS: PrivateCloudCapability[] = [
  {
    title: 'Who owns the data?',
    description:
      'Your organization does. Accounts and admin access are in your name, and the software is open source.',
  },
  {
    title: 'What if HAI is no longer around?',
    description:
      'Documentation is handed over so another qualified provider can take over, and your data stays in open formats.',
  },
  {
    title: 'What will it cost?',
    description:
      'That depends on how many people use it and how much you store. You get a written estimate before you commit to anything.',
  },
];

export interface StackComponent {
  /** What it does, in plain language. */
  role: string;
  /** The project's name, or empty when no single project is named. */
  project: string;
  description: string;
  /** Official project site; omitted when no single project is named. */
  url?: string;
}

export const STACK_QUALIFIER =
  'The exact stack varies by customer. We choose from these projects to fit what you need; no customer automatically gets every service.';

export const STACK_HERO = {
  eyebrow: 'Private cloud · Open-source stack',
  title: 'The open-source stack.',
  summary:
    'Mature, widely used open-source projects, chosen and configured for what you need. None of it is our own invention, so none of it ties you to us.',
  action: { label: 'Start an assessment', route: ASSESSMENT_ROUTE },
};

export const CORE_SERVICES: StackComponent[] = [
  {
    role: 'Files and collaboration',
    project: 'Nextcloud',
    description:
      'Syncs and shares files across computers and phones, with calendars, contacts, and shared editing for teams and families.',
    url: 'https://nextcloud.com',
  },
  {
    role: 'Photos',
    project: 'Immich',
    description:
      'Backs up photos and videos from phones and organizes them into a searchable library you can browse and share.',
    url: 'https://immich.app',
  },
  {
    role: 'Media',
    project: 'Jellyfin',
    description:
      'Streams your own movies, shows, and music to apps on TVs, phones, tablets, and web browsers.',
    url: 'https://jellyfin.org',
  },
  {
    role: 'Documents',
    project: 'Paperless-ngx',
    description:
      'Turns scanned paperwork into a searchable archive, reading the text so you can find a document by what it says.',
    url: 'https://github.com/paperless-ngx/paperless-ngx',
  },
  {
    role: 'Passwords',
    project: 'Vaultwarden',
    description:
      'A lightweight, unofficial server that works with the Bitwarden password manager apps and browser extensions.',
    url: 'https://github.com/dani-garcia/vaultwarden',
  },
];

export const PLATFORM_COMPONENTS: StackComponent[] = [
  {
    role: 'Operating system',
    project: 'Debian or Ubuntu Linux',
    description:
      'Stable, long-supported Linux distributions that run the whole system.',
  },
  {
    role: 'Service packaging',
    project: 'Docker Compose',
    description:
      'Runs each service in its own container from a written configuration, so the setup is documented and can be moved or rebuilt.',
    url: 'https://docs.docker.com/compose/',
  },
  {
    role: 'Reverse proxy and TLS',
    project: '',
    description:
      'One front door that sends each request to the right service and encrypts connections with HTTPS certificates.',
  },
  {
    role: 'Remote access',
    project: 'WireGuard',
    description:
      'A modern VPN that creates an encrypted tunnel, so you can reach the system away from home or the office.',
    url: 'https://www.wireguard.com',
  },
  {
    role: 'Backups',
    project: 'Restic',
    description:
      'Makes encrypted, deduplicated backups to a separate drive or remote storage, and restores from them.',
    url: 'https://restic.net',
  },
  {
    role: 'Monitoring',
    project: 'Uptime Kuma',
    description:
      'Checks that each service is responding and sends an alert when one is not.',
    url: 'https://github.com/louislam/uptime-kuma',
  },
  {
    role: 'Storage and health checks',
    project: '',
    description:
      'Regular checks on drive health and free space, so a failing disk is noticed before it loses data.',
  },
];

export const STACK_ARCHITECTURE: ArchitectureTier[] = [
  {
    label: 'How you connect',
    items: [
      'Apps and browsers on your devices',
      'WireGuard for access away from home',
      'Reverse proxy with TLS',
    ],
  },
  {
    label: 'Services',
    items: ['Nextcloud', 'Immich', 'Jellyfin', 'Paperless-ngx', 'Vaultwarden'],
  },
  {
    label: 'Platform',
    items: ['Docker Compose', 'Debian or Ubuntu Linux'],
  },
  {
    label: 'Storage and safety',
    items: [
      'Drives with health checks',
      'Restic backups to a second copy',
      'Uptime Kuma monitoring',
    ],
  },
];

export const STACK_ARCHITECTURE_CAPTION =
  'A typical arrangement. Your system includes only the services you choose.';

export const APPLIANCES_HERO = {
  eyebrow: 'Turn-key appliances',
  title: 'Servers that stay in your office.',
  summary:
    'Pre-configured on-premises server appliances, now including private cloud appliances for homes and organizations. Hardware at actual cost, labor at a published hourly rate.',
  action: { label: 'Schedule a free audit', route: '/contact' },
  links: [
    {
      label: 'Business appliances',
      route: '/turn-key-appliances',
      fragment: 'appliances',
    },
    {
      label: 'Private cloud appliances',
      route: '/turn-key-appliances',
      fragment: 'private-cloud-appliances',
    },
  ],
};

/** Capability tiers, not models: hardware is chosen after the assessment. */
export const PRIVATE_CLOUD_APPLIANCE_TIERS: AudiencePath[] = [
  {
    eyebrow: 'Home',
    title: 'Household private cloud',
    message: 'Files, photos, media, and backups for a family.',
    audiences: [
      'A few people and their devices',
      'Photo and media libraries',
      'Quiet enough for a home office',
    ],
    route: '/private-cloud/home',
    linkLabel: 'Private cloud for your home',
  },
  {
    eyebrow: 'Small organization',
    title: 'Team private cloud',
    message:
      'Shared files, backups, and passwords for a faith group, nonprofit, or small office.',
    audiences: [
      'A small staff or volunteer team',
      'Shared folders with per-person access',
      'Storage that can grow over time',
    ],
    route: '/private-cloud/organizations',
    linkLabel: 'Private cloud for organizations',
  },
  {
    eyebrow: 'Growing organization',
    title: 'Expanded private cloud',
    message:
      'For more people, larger archives, or several services running side by side.',
    audiences: [
      'More users and larger archives',
      'Mirrored drives for resilience',
      'Room for media and document libraries',
    ],
    route: '/private-cloud/organizations',
    linkLabel: 'Private cloud for organizations',
  },
];

export const PRIVATE_CLOUD_APPLIANCE_NOTE =
  'Exact hardware is chosen after the assessment, based on what you store and how many people use it. Models and prices depend on availability.';

export const SOFTWARE_STACKS_HERO = {
  eyebrow: 'Software stacks',
  title: 'Tools matched to your trade.',
  summary:
    'Dedicated hardware paired with custom and vetted open-source software for regional industries, plus a private cloud stack for homes and organizations.',
  action: { label: 'Schedule a free audit', route: '/contact' },
  links: [
    {
      label: 'Industry stacks',
      route: '/software-stacks',
      fragment: 'stacks',
    },
    {
      label: 'Private cloud stack',
      route: '/software-stacks',
      fragment: 'private-cloud-stack',
    },
  ],
};

export const PRIVATE_CLOUD_STACK_SUMMARY =
  'Files, photos, media, documents, and passwords for homes and organizations, built from mature open-source projects on hardware you own.';
