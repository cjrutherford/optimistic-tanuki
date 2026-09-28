import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';

export type AppCatalogGroup = 'publicApps' | 'internalTools';

export interface AppCatalogEntry {
  id: string;
  root?: string;
  name: string;
  group: AppCatalogGroup;
  registryId: string;
  tagline: string;
  category: string;
}

export const APP_CATALOG: AppCatalogEntry[] = [
  {
    id: 'hai',
    root: 'apps/hai',
    name: 'HAI',
    registryId: 'hai',
    group: 'publicApps',
    tagline: 'Company website and ecosystem entry point.',
    category: 'Company',
  },
  {
    id: 'system-configurator',
    root: 'apps/system-configurator',
    name: 'HAI Computer',
    registryId: 'system-configurator',
    group: 'publicApps',
    tagline: 'Build-to-order personal cloud and homelab configurator.',
    category: 'Configuration',
  },
  {
    id: 'store-client',
    root: 'apps/store-client',
    name: 'HAI Store',
    registryId: 'store',
    group: 'publicApps',
    tagline: 'Public store for HAI products and services.',
    category: 'Commerce',
  },
  {
    id: 'leads-app',
    root: 'apps/leads-app',
    name: 'Opportunity Compass',
    registryId: 'opportunity-compass',
    group: 'publicApps',
    tagline: 'Opportunity discovery from interests, locality, and skills.',
    category: 'Opportunity discovery',
  },
  {
    id: 'client-interface',
    root: 'apps/client-interface',
    name: 'Optimistic Tanuki',
    registryId: 'client-interface',
    group: 'publicApps',
    tagline: 'Social media, identity, messaging, and utility workflows.',
    category: 'Community',
  },
  {
    id: 'forgeofwill',
    root: 'apps/forgeofwill',
    name: 'Forge of Will',
    registryId: 'forgeofwill',
    group: 'publicApps',
    tagline: 'Personal project planning and execution workspace.',
    category: 'Project execution',
  },
  {
    id: 'digital-homestead',
    root: 'apps/digital-homestead',
    name: 'Digital Grange',
    registryId: 'digital-homestead',
    group: 'publicApps',
    tagline: 'Homestead publishing and community storytelling experience.',
    category: 'Personal publishing',
  },
  {
    id: 'd6',
    root: 'apps/d6',
    name: 'D6 Wellness Tracker',
    registryId: 'd6',
    group: 'publicApps',
    tagline: 'Wellness tracking and daily practice workflows.',
    category: 'Wellness',
  },
  {
    id: 'local-hub',
    root: 'apps/local-hub',
    name: 'Towne Square',
    registryId: 'local-hub',
    group: 'publicApps',
    tagline: 'Local-first community, classifieds, and business listings.',
    category: 'Local community',
  },
  {
    id: 'fin-commander',
    root: 'apps/fin-commander',
    name: 'Fin Commander',
    registryId: 'fin-commander',
    group: 'publicApps',
    tagline:
      'Guided personal finance workflows for accounts, plans, and scenarios.',
    category: 'Finance',
  },
  {
    id: 'business-site',
    root: 'apps/business-site',
    name: 'Signal Foundry',
    registryId: 'business-site',
    group: 'publicApps',
    tagline:
      'Business marketing, scheduling, portal, and owner operations app.',
    category: 'Marketing',
  },
  {
    id: 'developer-portal',
    root: 'apps/developer-portal',
    name: 'Developer Portal',
    registryId: 'developer-portal',
    group: 'publicApps',
    tagline: 'Docs, onboarding, and developer-facing platform entry point.',
    category: 'Developer experience',
  },
  {
    id: 'video-client',
    root: 'apps/video-client',
    name: 'Video Platform',
    registryId: 'video-platform',
    group: 'publicApps',
    tagline: 'Upload, playback, and channel workflows for video content.',
    category: 'Media',
  },
  {
    id: 'learning',
    root: 'apps/learning',
    name: "Let's Go",
    registryId: 'learning',
    group: 'publicApps',
    tagline:
      'A learning platform for any subject, with courses anyone can write.',
    category: 'Education',
  },
  {
    id: 'owner-console',
    root: 'apps/owner-console',
    name: 'Owner Console',
    registryId: 'owner-console',
    group: 'internalTools',
    tagline: 'Internal operator console for registry and platform management.',
    category: 'Operations',
  },
  {
    id: 'configurable-client',
    root: 'apps/configurable-client',
    name: 'Configurable Client',
    registryId: 'configurable-client',
    group: 'internalTools',
    tagline:
      'Config-driven application shell for generated client experiences.',
    category: 'Application platform',
  },
  {
    id: 'business-configurator',
    root: 'apps/business-configurator',
    name: 'Business Site Builder',
    registryId: 'business-configurator',
    group: 'internalTools',
    tagline: 'Builder for configurable business-site experiences.',
    category: 'Application platform',
  },
  {
    id: 'ui-playground',
    root: 'apps/ui-playground',
    name: 'UI Playground',
    registryId: 'ui-playground',
    group: 'internalTools',
    tagline: 'Internal component and docs playground.',
    category: 'Design system',
  },
];

export const APP_CATALOG_GROUPS: Record<AppCatalogGroup, AppCatalogEntry[]> = {
  publicApps: APP_CATALOG.filter((app) => app.group === 'publicApps'),
  internalTools: APP_CATALOG.filter((app) => app.group === 'internalTools'),
};

export const APP_CATALOG_GROUP_LABELS: Record<AppCatalogGroup, string> = {
  publicApps: 'Public apps',
  internalTools: 'Internal tools',
};

export function isRegisteredWebApp(app: AppRegistration): boolean {
  return (
    (app.appType === 'client' || app.appType === 'admin') &&
    Boolean(app.uiBaseUrl?.trim()) &&
    app.appId !== 'christopherrutherford-net'
  );
}

export function getRegisteredWebAppCatalog(
  apps: AppRegistration[]
): AppCatalogEntry[] {
  return apps.filter(isRegisteredWebApp).map((registeredApp) => {
    const metadata = APP_CATALOG.find(
      (entry) => entry.registryId === registeredApp.appId
    );
    const group =
      registeredApp.visibility === 'internal' ? 'internalTools' : 'publicApps';

    return {
      id: metadata?.id ?? registeredApp.appId,
      root: metadata?.root,
      name: registeredApp.name,
      group,
      registryId: registeredApp.appId,
      tagline:
        registeredApp.description ??
        metadata?.tagline ??
        `Part of the ${
          group === 'internalTools' ? 'internal' : 'public'
        } app catalog.`,
      category:
        metadata?.category ??
        (group === 'internalTools' ? 'Internal tool' : 'Web app'),
    };
  });
}
