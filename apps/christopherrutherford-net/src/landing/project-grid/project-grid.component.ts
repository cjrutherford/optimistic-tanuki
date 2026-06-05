import { Component, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  CardComponent,
  HeadingComponent,
  TileComponent,
} from '@optimistic-tanuki/common-ui';
import {
  HaiAppDirectoryService,
  HaiResolvedAppLink,
} from '@optimistic-tanuki/hai-ui';
import { map } from 'rxjs';
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
  repoHref: string;
  isPublic: boolean;
  initials: string;
}

@Component({
  selector: 'app-project-grid',
  imports: [CommonModule, TileComponent, HeadingComponent, CardComponent],
  templateUrl: './project-grid.component.html',
  styleUrl: './project-grid.component.scss',
})
export class ProjectGridComponent {
  private readonly appDirectory = inject(HaiAppDirectoryService);
  private readonly portfolioEntries = PORTFOLIO_ENTRIES;

  readonly projects$ = this.appDirectory
    .getResolvedApps()
    .pipe(map((apps) => this.toPortfolioCards(apps)));

  private toPortfolioCards(
    apps: HaiResolvedAppLink[]
  ): PortfolioCardViewModel[] {
    const appMap = new Map(apps.map((app) => [app.appId, app]));

    return this.portfolioEntries
      .map((entry) => {
        const app = appMap.get(entry.id);
        if (!app) {
          return null;
        }

        return {
          id: entry.id,
          name: app.name,
          category: app.category,
          tagline: app.tagline,
          summary: entry.summary,
          proof: entry.proof,
          tone: entry.tone,
          logoSrc: app.logoSrc,
          liveHref: app.isPublic ? app.resolvedHref : undefined,
          repoHref: app.repositoryUrl,
          isPublic: app.isPublic,
          initials: this.getInitials(app.name),
        } satisfies PortfolioCardViewModel;
      })
      .filter((entry): entry is Exclude<typeof entry, null> => entry !== null);
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
