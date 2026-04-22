import { Component } from '@angular/core';

import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { BlogPostCardComponent } from '@optimistic-tanuki/blogging-ui';
import {
  HaiAppDirectoryService,
  HaiResolvedAppLink,
} from '@optimistic-tanuki/hai-ui';
import { CommonModule } from '@angular/common';

interface PortfolioProject {
  title: string;
  bannerImage: string;
  excerpt: string;
  readMoreText: string;
  readMoreLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
}

@Component({
  selector: 'app-project-grid',
  imports: [CommonModule, TileComponent, HeadingComponent, BlogPostCardComponent],
  templateUrl: './project-grid.component.html',
  styleUrl: './project-grid.component.scss',
})
export class ProjectGridComponent {
  readonly projects$ = this.appDirectory.getResolvedApps();

  private readonly bannerImages: Record<string, string> = {
    'optimistic-tanuki': 'assets/images/tanuki.png',
    'towne-square': 'assets/images/private-cloud.png',
    'forge-of-will': 'assets/images/open-project.png',
    'fin-commander': 'assets/images/firefly-iii.svg',
    'opportunity-compass': 'assets/images/process-analytics.png',
  };

  constructor(private readonly appDirectory: HaiAppDirectoryService) {}

  portfolioProjects(apps: HaiResolvedAppLink[]): PortfolioProject[] {
    return apps.map((app) => ({
      title: app.name,
      bannerImage: this.bannerImages[app.appId] ?? 'assets/images/custom-app.png',
      excerpt: app.portfolioSummary,
      readMoreText: app.isPublic ? 'Open Project' : 'View Repository',
      readMoreLink: app.resolvedHref,
      secondaryButtonText: app.isPublic ? 'View Repository' : '',
      secondaryButtonLink: app.isPublic ? app.repositoryUrl : '',
    }));
  }

  linkTo(url: string): void {
    window.open(url, '_blank');
  }
}
