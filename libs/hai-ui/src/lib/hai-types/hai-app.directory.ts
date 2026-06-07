import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
import { HaiAppLink } from './hai-app.config';

const REPOSITORY_ROOT =
  'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps';

export interface HaiRegistryApp extends HaiAppLink {
  configName: string;
  category: string;
  appPath: string;
  portfolioSummary: string;
  repositoryUrl: string;
}

export interface HaiResolvedAppLink extends HaiRegistryApp {
  /**
   * Primary destination for the card. Resolves to the running application URL
   * when one is published, otherwise falls back to the repository URL.
   * Retained for backward compatibility with single-link consumers.
   */
  resolvedHref: string;
  /** True when a public running application URL is available. */
  isPublic: boolean;
  /**
   * The running/preview application URL, present only when the app is publicly
   * reachable. App cards should render this as the "Open app" link. When
   * undefined, only the repository link should be shown.
   */
  runUrl?: string;
}

export const HAI_APP_DIRECTORY: HaiRegistryApp[] = [
  {
    appId: 'optimistic-tanuki',
    configName: 'client-interface',
    name: 'Optimistic Tanuki',
    tagline:
      'General social media, identity, messaging, and utility workflows.',
    href: '/optimistic-tanuki',
    category: 'Social Platform',
    appPath: 'client-interface',
    repositoryUrl: `${REPOSITORY_ROOT}/client-interface`,
    portfolioSummary:
      'A resume-building social platform project where I built social media, messaging, identity, profile, and utility workflows across a larger microservice-oriented product surface.',
  },
  {
    appId: 'towne-square',
    configName: 'local-hub',
    name: 'Towne Square',
    tagline: 'Local-first social media, classifieds, and business listings.',
    href: '/towne-square',
    category: 'Local Community',
    appPath: 'local-hub',
    repositoryUrl: `${REPOSITORY_ROOT}/local-hub`,
    portfolioSummary:
      'A local-first community product that combines neighborhood social media, classifieds, business listings, commerce, and community discovery into one civic software project.',
  },
  {
    appId: 'forge-of-will',
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
    const runUrl = matchingApp?.uiBaseUrl || undefined;
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
