export type CatalogEntry = {
  path: string;
  name: string;
  description: string;
  componentCount: number;
  category: string;
  detail?: string;
  packageSlug?: string;
};

export type CatalogNavSection = {
  title: string;
  description: string;
  entries: readonly CatalogEntry[];
};

export type RecommendedPath = {
  title: string;
  description: string;
  cta: string;
  path: string;
};

export type TaskPath = {
  title: string;
  description: string;
  entries: readonly CatalogEntry[];
};

const documentationEntry: CatalogEntry = {
  path: '/docs',
  name: 'Documentation',
  description:
    'Guides, migration notes, architecture references, and API docs.',
  componentCount: 12,
  category: 'Docs',
  detail: 'Guides and API references',
};

const operatorHandbookEntry: CatalogEntry = {
  path: '/docs/operators/overview',
  name: 'Operator Handbook',
  description:
    'Canonical entry point for platform operators managing local and deployed environments.',
  componentCount: 1,
  category: 'Docs',
  detail: 'Operator guide',
};

const runbooksEntry: CatalogEntry = {
  path: '/docs/operators/runbooks',
  name: 'Runbooks',
  description:
    'Repeatable operator procedures for startup, verification, deployment validation, and recovery.',
  componentCount: 1,
  category: 'Docs',
  detail: 'Operational procedures',
};

const validationEntry: CatalogEntry = {
  path: '/validation',
  name: 'Validation Board',
  description:
    'Cross-library checks for theme, messaging, and representative UI states.',
  componentCount: 15,
  category: 'Workflow',
  detail: 'Cross-library QA surface',
};

const motionUiEntry: CatalogEntry = {
  path: '/motion-ui',
  name: 'Motion UI',
  description:
    'Ambient backgrounds and decorative motion primitives built with CSS and Three.js.',
  componentCount: 9,
  category: 'Decorative',
  packageSlug: 'motion-ui',
};

const commonUiEntry: CatalogEntry = {
  path: '/common-ui',
  name: 'Common UI',
  description:
    'Core UI primitives: buttons, cards, modals, tables, lists, and layout components.',
  componentCount: 18,
  category: 'Core',
  packageSlug: 'common-ui',
};

const formUiEntry: CatalogEntry = {
  path: '/form-ui',
  name: 'Form UI',
  description:
    'Form inputs: text fields, checkboxes, radio buttons, selects, and file uploads.',
  componentCount: 6,
  category: 'Forms',
  packageSlug: 'form-ui',
};

const themeUiEntry: CatalogEntry = {
  path: '/theme-ui',
  name: 'Theme UI',
  description:
    'Theming controls: palette selectors, personality previews, and design token managers.',
  componentCount: 6,
  category: 'Theming',
  packageSlug: 'theme-ui',
};

const navigationUiEntry: CatalogEntry = {
  path: '/navigation-ui',
  name: 'Navigation UI',
  description:
    'Navigation components: app bars, sidebars, and navigation menus.',
  componentCount: 3,
  category: 'Navigation',
  packageSlug: 'navigation-ui',
};

const socialUiEntry: CatalogEntry = {
  path: '/social-ui',
  name: 'Social UI',
  description:
    'Social components: posts, comments, compose editors, and activity feeds.',
  componentCount: 4,
  category: 'Social',
  packageSlug: 'social-ui',
};

const notificationUiEntry: CatalogEntry = {
  path: '/notification-ui',
  name: 'Notification UI',
  description:
    'Notification components: bells, lists, and real-time update indicators.',
  componentCount: 2,
  category: 'Feedback',
  packageSlug: 'notification-ui',
};

const storeUiEntry: CatalogEntry = {
  path: '/store-ui',
  name: 'Store UI',
  description:
    'E-commerce components: product cards, lists, shopping carts, and donations.',
  componentCount: 4,
  category: 'Commerce',
  packageSlug: 'store-ui',
};

const authUiEntry: CatalogEntry = {
  path: '/auth-ui',
  name: 'Auth UI',
  description:
    'Authentication workflow primitives for login, registration, email confirmation, and MFA.',
  componentCount: 4,
  category: 'Identity',
  packageSlug: 'auth-ui',
};

const profileUiEntry: CatalogEntry = {
  path: '/profile-ui',
  name: 'Profile UI',
  description:
    'Profile management surfaces for selectors, editors, and identity banners.',
  componentCount: 3,
  category: 'Identity',
  packageSlug: 'profile-ui',
};

const chatUiEntry: CatalogEntry = {
  path: '/chat-ui',
  name: 'Chat UI',
  description:
    'Conversation primitives for contact rosters and embedded chat windows.',
  componentCount: 2,
  category: 'Workflow',
  packageSlug: 'chat-ui',
};

const messageUiEntry: CatalogEntry = {
  path: '/message-ui',
  name: 'Message UI',
  description:
    'Dismissible message stack for system alerts and inline workflow feedback.',
  componentCount: 1,
  category: 'Feedback',
  packageSlug: 'message-ui',
};

const searchUiEntry: CatalogEntry = {
  path: '/search-ui',
  name: 'Search UI',
  description:
    'Search and exploration surfaces for people, communities, and content discovery.',
  componentCount: 2,
  category: 'Search',
  packageSlug: 'search-ui',
};

const personaUiEntry: CatalogEntry = {
  path: '/persona-ui',
  name: 'Persona UI',
  description:
    'Assistant persona picker for selecting AI helpers and working modes.',
  componentCount: 1,
  category: 'Identity',
  packageSlug: 'persona-ui',
};

const agGridUiEntry: CatalogEntry = {
  path: '/ag-grid-ui',
  name: 'AG Grid UI',
  description:
    'Theme-aware enterprise data grid wrapper for dense application tables.',
  componentCount: 1,
  category: 'Data',
  packageSlug: 'ag-grid-ui',
};

const bloggingUiEntry: CatalogEntry = {
  path: '/blogging-ui',
  name: 'Blogging UI',
  description:
    'Blog and content management components for editorial experiences.',
  componentCount: 7,
  category: 'Content',
  packageSlug: 'blogging-ui',
};

const businessUiEntry: CatalogEntry = {
  path: '/business-ui',
  name: 'Business UI',
  description: 'Business and enterprise UI components for B2B applications.',
  componentCount: 1,
  category: 'Commerce',
  packageSlug: 'business-ui',
};

const classifiedUiEntry: CatalogEntry = {
  path: '/classified-ui',
  name: 'Classifieds UI',
  description: 'Classified ads and marketplace listing components.',
  componentCount: 1,
  category: 'Commerce',
  packageSlug: 'classified-ui',
};

const communityUiEntry: CatalogEntry = {
  path: '/community-ui',
  name: 'Community UI',
  description:
    'Community building and engagement components for social platforms.',
  componentCount: 1,
  category: 'Social',
  packageSlug: 'community-ui',
};

const forumUiEntry: CatalogEntry = {
  path: '/forum-ui',
  name: 'Forum UI',
  description:
    'Forum and discussion board components for community conversations.',
  componentCount: 2,
  category: 'Social',
  packageSlug: 'forum-ui',
};

const haiUiEntry: CatalogEntry = {
  path: '/hai-ui',
  name: 'HAI UI',
  description:
    'Human-AI interaction components for intelligent assistant interfaces.',
  componentCount: 3,
  category: 'AI',
  packageSlug: 'hai-ui',
};

const paymentsUiEntry: CatalogEntry = {
  path: '/payments-ui',
  name: 'Payments UI',
  description: 'Payment processing and transaction UI components.',
  componentCount: 3,
  category: 'Commerce',
  packageSlug: 'payments-ui',
};

const projectUiEntry: CatalogEntry = {
  path: '/project-ui',
  name: 'Project UI',
  description: 'Project management and task tracking UI components.',
  componentCount: 3,
  category: 'Productivity',
  packageSlug: 'project-ui',
};

export const playgroundLibraries: readonly CatalogEntry[] = [
  motionUiEntry,
  commonUiEntry,
  formUiEntry,
  themeUiEntry,
  navigationUiEntry,
  socialUiEntry,
  notificationUiEntry,
  storeUiEntry,
  authUiEntry,
  profileUiEntry,
  chatUiEntry,
  messageUiEntry,
  searchUiEntry,
  personaUiEntry,
  agGridUiEntry,
  bloggingUiEntry,
  businessUiEntry,
  classifiedUiEntry,
  communityUiEntry,
  forumUiEntry,
  haiUiEntry,
  paymentsUiEntry,
  projectUiEntry,
];

export const navSections: readonly CatalogNavSection[] = [
  {
    title: 'Start Here',
    description:
      'Begin with the core library, then branch into docs or validation.',
    entries: [commonUiEntry, documentationEntry, operatorHandbookEntry],
  },
  {
    title: 'Build UI',
    description:
      'Core building blocks, forms, layout, and presentation systems.',
    entries: [
      formUiEntry,
      navigationUiEntry,
      themeUiEntry,
      motionUiEntry,
      notificationUiEntry,
      socialUiEntry,
    ],
  },
  {
    title: 'Workflows',
    description:
      'Product flows, identity surfaces, commerce, and operational checks.',
    entries: [
      runbooksEntry,
      authUiEntry,
      profileUiEntry,
      chatUiEntry,
      messageUiEntry,
      storeUiEntry,
      bloggingUiEntry,
      businessUiEntry,
      classifiedUiEntry,
      communityUiEntry,
      forumUiEntry,
      paymentsUiEntry,
      projectUiEntry,
      validationEntry,
    ],
  },
  {
    title: 'Data & Search',
    description:
      'Discovery, assistant selection, data tables, and AI-adjacent surfaces.',
    entries: [searchUiEntry, personaUiEntry, agGridUiEntry, haiUiEntry],
  },
];

export const recommendedPaths: readonly RecommendedPath[] = [
  {
    title: 'Read the docs first',
    description:
      'Use the docs hub for migration notes, architecture, and package-level guidance.',
    cta: 'Open Documentation',
    path: documentationEntry.path,
  },
  {
    title: 'Start with core components',
    description:
      'Buttons, cards, modals, tables, and other reusable primitives live in Common UI.',
    cta: 'Browse Components',
    path: commonUiEntry.path,
  },
  {
    title: 'Validate themes and shared states',
    description:
      'Use the validation board to verify personalities, modes, and cross-library behaviors.',
    cta: 'Open Validation Board',
    path: validationEntry.path,
  },
];

export const taskPaths: readonly TaskPath[] = [
  {
    title: 'Forms',
    description: 'Inputs, validation surfaces, and submission flows.',
    entries: [formUiEntry, authUiEntry, themeUiEntry],
  },
  {
    title: 'Navigation',
    description: 'App framing, menus, sidebars, and wayfinding.',
    entries: [navigationUiEntry, commonUiEntry],
  },
  {
    title: 'Feedback',
    description: 'Alerts, inline status messages, and notification surfaces.',
    entries: [notificationUiEntry, messageUiEntry],
  },
  {
    title: 'Commerce',
    description: 'Storefront, business, payments, and marketplace flows.',
    entries: [
      storeUiEntry,
      businessUiEntry,
      classifiedUiEntry,
      paymentsUiEntry,
    ],
  },
  {
    title: 'Search',
    description: 'Search, discovery, and dense data exploration.',
    entries: [searchUiEntry, agGridUiEntry],
  },
  {
    title: 'Identity',
    description: 'Authentication, profiles, and persona selection.',
    entries: [authUiEntry, profileUiEntry, personaUiEntry],
  },
];

export function getCatalogEntryByPackageSlug(
  packageSlug: string
): CatalogEntry | undefined {
  return playgroundLibraries.find((entry) => entry.packageSlug === packageSlug);
}
