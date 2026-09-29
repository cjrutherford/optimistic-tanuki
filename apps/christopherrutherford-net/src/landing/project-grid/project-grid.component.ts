import { Component, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { map } from 'rxjs';
import {
  APP_CATALOG,
  getRegisteredWebAppCatalog,
  isRegisteredWebApp,
} from '../app-catalog.data';
import { PORTFOLIO_ENTRIES } from '../portfolio.data';

interface PortfolioCardViewModel {
  id: string;
  name: string;
  category: string;
  tagline: string;
  summary: string;
  proof: string;
  tone: (typeof PORTFOLIO_ENTRIES)[number]['tone'];
  logoSrc?: string;
  liveHref?: string;
  repoHref?: string;
  initials: string;
}

const REPOSITORY_ROOT =
  'https://github.com/cjrutherford/optimistic-tanuki/tree/main/';

@Component({
  selector: 'app-project-grid',
  imports: [CommonModule, HeadingComponent, CardComponent],
  templateUrl: './project-grid.component.html',
  styleUrl: './project-grid.component.scss',
})
export class ProjectGridComponent {
  private readonly registry = inject(AppRegistryService);

  readonly projects$ = this.registry
    .getAllApps()
    .pipe(map((apps) => this.toPortfolioCards(apps)));

  private toPortfolioCards(apps: AppRegistration[]): PortfolioCardViewModel[] {
    const catalogEntries = getRegisteredWebAppCatalog(apps);
    const portfolioEntries = new Map(
      PORTFOLIO_ENTRIES.map((entry) => [entry.id, entry])
    );

    return apps.filter(isRegisteredWebApp).map((registryEntry) => {
      const catalogEntry = catalogEntries.find(
        (entry) => entry.registryId === registryEntry.appId
      );
      const staticEntry = APP_CATALOG.find(
        (entry) => entry.registryId === registryEntry.appId
      );
      const portfolioEntry =
        catalogEntry && portfolioEntries.get(catalogEntry.id);
      const name = registryEntry.name;

      return {
        id: catalogEntry?.id ?? registryEntry.appId,
        name,
        category:
          registryEntry.visibility === 'internal'
            ? staticEntry?.group === 'internalTools'
              ? staticEntry.category
              : 'Internal tool'
            : catalogEntry?.category ?? 'Web app',
        tagline:
          registryEntry.description ??
          catalogEntry?.tagline ??
          'Part of the app catalog.',
        summary: portfolioEntry?.summary ?? `${name} is part of the platform.`,
        proof: portfolioEntry?.proof ?? 'Explore this application.',
        tone:
          registryEntry.visibility === 'internal'
            ? 'internal'
            : portfolioEntry?.tone ?? 'business',
        logoSrc: getPublicExternalUrl(registryEntry.iconUrl),
        liveHref: this.getVisitUrl(registryEntry),
        repoHref: catalogEntry?.root
          ? `${REPOSITORY_ROOT}${catalogEntry.root}`
          : undefined,
        initials: this.getInitials(name),
      } satisfies PortfolioCardViewModel;
    });
  }

  private getVisitUrl(app?: AppRegistration): string | undefined {
    if (app?.visibility !== 'public' || !app.uiBaseUrl) return undefined;
    return getPublicExternalUrl(app.uiBaseUrl);
  }

  private getInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}

export function getPublicExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const hostname = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .replace(/\.+$/, '');
    const isIpAddress =
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
    const isLocalHostname =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.invalid') ||
      hostname.endsWith('.example');

    if (
      url.protocol !== 'https:' ||
      !hostname.includes('.') ||
      isIpAddress ||
      isLocalHostname
    ) {
      return undefined;
    }

    return url.href;
  } catch {
    return undefined;
  }
}
