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
  resolvedHref: string;
  isPublic: boolean;
}

export interface HaiAppConfigLinkSource {
  name: string;
  domain?: string;
  active?: boolean;
}

export const HAI_APP_DIRECTORY: HaiRegistryApp[] = [
  {
    appId: 'optimistic-tanuki',
    configName: 'client-interface',
    name: 'Optimistic Tanuki',
    tagline: 'General social media, identity, messaging, and utility workflows.',
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
    configName: 'leads-app',
    name: 'Opportunity Compass',
    tagline: 'Opportunity discovery from interests, locality, and skills.',
    href: '/opportunity-compass',
    category: 'Discovery',
    appPath: 'leads-app',
    repositoryUrl: `${REPOSITORY_ROOT}/leads-app`,
    portfolioSummary:
      'An opportunity discovery tool that helps users turn interests, location, skills, and onboarding context into potential leads, prospects, and next-step opportunities.',
  },
];

export function getHaiAppLinks(currentAppId?: string): HaiAppLink[] {
  return HAI_APP_DIRECTORY.filter((app) => app.appId !== currentAppId);
}

export function resolveHaiAppLinks(
  appConfigs: HaiAppConfigLinkSource[],
  currentAppId?: string
): HaiResolvedAppLink[] {
  return HAI_APP_DIRECTORY.filter((app) => app.appId !== currentAppId).map(
    (app) => {
      const matchingConfig = appConfigs.find(
        (config) => config.name === app.configName
      );
      const domain = normalizeDomain(matchingConfig?.domain);
      const isPublic = matchingConfig?.active === true && !!domain;

      return {
        ...app,
        resolvedHref: isPublic ? domain : app.repositoryUrl,
        isPublic,
      };
    }
  );
}

function normalizeDomain(domain?: string): string {
  if (!domain) {
    return '';
  }

  if (/^https?:\/\//.test(domain)) {
    return domain;
  }

  return `https://${domain}`;
}
