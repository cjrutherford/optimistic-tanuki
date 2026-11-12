import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
import { HaiAppLink } from './hai-app.config';

const REPOSITORY_ROOT =
  'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps';

/**
 * Where a product is in its life. `available` needs release evidence;
 * `planned` products have nothing to open and must not be linked.
 */
export type HaiAppStatus =
  | 'available'
  | 'early-access'
  | 'in-development'
  | 'planned';

export const HAI_APP_STATUS_LABELS: Record<HaiAppStatus, string> = {
  available: 'Available',
  'early-access': 'Early access',
  'in-development': 'In development',
  planned: 'Planned',
};

export interface HaiRegistryApp extends HaiAppLink {
  configName: string;
  /** Optional so existing consumers keep compiling; unset shows no status. */
  status?: HaiAppStatus;
  category: string;
  appPath: string;
  portfolioSummary: string;
  /**
   * Absent for products that live in a separate repository we do not link
   * to; such a card renders without a link.
   */
  repositoryUrl?: string;
}

export interface HaiResolvedAppLink extends HaiRegistryApp {
  /**
   * Primary destination for the card. Resolves to the running application URL
   * when one is published, otherwise falls back to the repository URL.
   * Retained for backward compatibility with single-link consumers. Undefined
   * when the product publishes neither an app nor a repository URL.
   */
  resolvedHref?: string;
  /** True when the registry supplies a valid public app destination; not a health check. */
  isPublic: boolean;
  /**
   * The running/preview application URL, present only when the registry publishes a public HTTP(S) destination. App cards should render this as the "Open app" link. When
   * undefined, only the repository link should be shown.
   */
  runUrl?: string;
}

export const HAI_APP_DIRECTORY: HaiRegistryApp[] = [
  {
    appId: 'optimistic-tanuki',
    status: 'early-access',
    configName: 'client-interface',
    name: 'Optimistic Tanuki',
    tagline:
      'Early-access posts, conversations, and communities around your interests.',
    href: '/optimistic-tanuki',
    category: 'Social Platform',
    appPath: 'client-interface',
    repositoryUrl: `${REPOSITORY_ROOT}/client-interface`,
    portfolioSummary:
      'A resume-building social platform project where I built social media, messaging, identity, profile, and utility workflows across a larger microservice-oriented product surface.',
  },
  {
    appId: 'towne-square',
    status: 'early-access',
    configName: 'local-hub',
    name: 'Towne Square',
    tagline: 'Early-access locality discovery and local community connection.',
    href: '/towne-square',
    category: 'Local Community',
    appPath: 'local-hub',
    repositoryUrl: `${REPOSITORY_ROOT}/local-hub`,
    portfolioSummary:
      'A local-first community product that combines neighborhood social media, classifieds, business listings, commerce, and community discovery into one civic software project.',
  },
  {
    appId: 'forge-of-will',
    status: 'in-development',
    configName: 'forgeofwill',
    name: 'Forge of Will',
    tagline: 'Personal project planning for deliberate work.',
    href: '/forge-of-will',
    category: 'Planning',
    appPath: 'forgeofwill',
    repositoryUrl: `${REPOSITORY_ROOT}/forgeofwill`,
    portfolioSummary:
      'A personal project planning tool where I explored task planning, journals, risk/change tracking, and intentional workflow design for focused personal execution.',
  },
  {
    appId: 'fin-commander',
    status: 'in-development',
    configName: 'fin-commander',
    name: 'Fin Commander',
    tagline: 'Small personal finance management for everyday clarity.',
    href: '/fin-commander',
    category: 'Finance',
    appPath: 'fin-commander',
    repositoryUrl: `${REPOSITORY_ROOT}/fin-commander`,
    portfolioSummary:
      'A small personal finance manager focused on making accounts, transactions, imports, and financial navigation understandable without enterprise-scale overhead.',
  },
  {
    appId: 'opportunity-compass',
    status: 'in-development',
    configName: 'opportunity-compass',
    name: 'Opportunity Compass',
    tagline: 'Opportunity discovery from interests, locality, and skills.',
    href: '/opportunity-compass',
    category: 'Discovery',
    appPath: 'leads-app',
    repositoryUrl: `${REPOSITORY_ROOT}/leads-app`,
    portfolioSummary:
      'An opportunity discovery tool that helps users turn interests, location, skills, and onboarding context into potential leads, prospects, and next-step opportunities.',
  },
  {
    appId: 'developer-portal',
    status: 'in-development',
    configName: 'developer-portal',
    name: 'Developer Portal',
    tagline: 'Docs, onboarding, and developer-facing platform entry.',
    href: '/developer-portal',
    category: 'Developer Experience',
    appPath: 'developer-portal',
    repositoryUrl: `${REPOSITORY_ROOT}/developer-portal`,
    portfolioSummary:
      'A developer-facing portal focused on SDK discovery, API orientation, onboarding, and helping external users get productive with the platform quickly.',
  },
  {
    appId: 'store-client',
    status: 'in-development',
    configName: 'store',
    name: 'Store',
    tagline: 'Bookings, donations, and storefront flows.',
    href: '/store',
    category: 'Commerce',
    appPath: 'store-client',
    repositoryUrl: `${REPOSITORY_ROOT}/store-client`,
    portfolioSummary:
      'A commerce shell for bookings, donations, purchases, and other transaction-driven customer workflows that need a clear path from browse to conversion.',
  },
  {
    appId: 'video-platform',
    status: 'in-development',
    configName: 'video-platform',
    name: 'Video Platform',
    tagline: 'Share and discover video content with communities.',
    href: '/video-platform',
    category: 'Media',
    appPath: 'video-client',
    repositoryUrl: `${REPOSITORY_ROOT}/video-client`,
    portfolioSummary:
      'A video platform spanning upload, playback, visibility, and channel workflows, with product concerns across both creator tooling and audience-facing experiences.',
  },
  {
    appId: 'homestead',
    status: 'in-development',
    configName: 'homestead',
    name: 'Homestead',
    tagline: 'A separate project, still in development.',
    href: '/homestead',
    category: 'Separate project',
    appPath: 'homestead',
    portfolioSummary:
      'A separate project kept in its own repository, still in development. It is distinct from the Digital Homestead site in this repository.',
  },
  {
    appId: 'statocyst',
    status: 'in-development',
    configName: 'statocyst',
    name: 'Statocyst',
    tagline: 'A separate project, still in development.',
    href: '/statocyst',
    category: 'Separate project',
    appPath: 'statocyst',
    portfolioSummary:
      'A separate project kept in its own repository, still in development.',
  },
];

export function getHaiAppLinks(currentAppId?: string): HaiAppLink[] {
  return HAI_APP_DIRECTORY.filter((app) => !isCurrentHaiApp(app, currentAppId));
}

export function resolveHaiAppLinks(
  apps: AppRegistration[],
  currentAppId?: string
): HaiResolvedAppLink[] {
  return HAI_APP_DIRECTORY.filter(
    (app) => !isCurrentHaiApp(app, currentAppId)
  ).map((app) => {
    const matchingApp = apps.find(
      (registryApp) => registryApp.appId === app.configName
    );
    const runUrl =
      matchingApp?.visibility === 'public'
        ? publicAppUrl(matchingApp.uiBaseUrl)
        : undefined;
    const isPublic = !!runUrl;
    const resolvedHref = runUrl ?? app.repositoryUrl;

    return {
      ...app,
      logoSrc: matchingApp?.iconUrl,
      resolvedHref,
      isPublic,
      runUrl,
    };
  });
}

function isCurrentHaiApp(app: HaiRegistryApp, currentAppId?: string): boolean {
  return (
    !!currentAppId &&
    (app.appId === currentAppId || app.configName === currentAppId)
  );
}

function publicAppUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    ) {
      // Preserve the published registry destination, including its path.
      return value;
    }
  } catch {
    /* An invalid registry destination has no public app link. */
  }
  return undefined;
}
