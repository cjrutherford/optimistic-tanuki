import { Component, inject } from '@angular/core';
import {
  CardComponent,
  HeadingComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';
import { HeroComponent } from '@optimistic-tanuki/blogging-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AudienceSelectorComponent } from '../../components/shared/audience-selector.component';
import type { AudiencePath } from '../../content/private-cloud';

@Component({
  selector: 'hai-training',
  imports: [
    CardComponent,
    HeadingComponent,
    HeroComponent,
    AudienceSelectorComponent,
    SectionHeadingComponent,
  ],
  providers: [ThemeService],
  templateUrl: './training.component.html',
  styleUrl: './training.component.scss',
})
export class TrainingComponent {
  themeService: ThemeService = inject(ThemeService);
  get heroImage() {
    return this.themeService.getTheme() === 'dark'
      ? 'assets/training-hero-dark.png'
      : 'assets/training-hero-light.png';
  }
  audiencePaths: AudiencePath[] = [
    {
      eyebrow: 'Technology Literacy',
      title: 'Getting Started with Technology',
      message:
        'Learn the basics of using computers, smartphones, and the internet.',
      audiences: ['Beginners', 'Non-technical users'],
      route: '#literacy',
      linkLabel: 'Explore Technology Literacy Topics',
    },
    {
      eyebrow: 'Software Development',
      title: 'Building Applications',
      message:
        'Learn how to design, develop, and deploy software applications.',
      audiences: ['Aspiring developers', 'Intermediate programmers'],
      route: '#software-development',
      linkLabel: 'Explore Software Development Topics',
    },
    {
      eyebrow: 'Data Science',
      title: 'Analyzing Data',
      message:
        'Learn how to collect, analyze, and interpret data to make informed decisions.',
      audiences: ['Aspiring data scientists', 'Business analysts'],
      route: '#data-science',
      linkLabel: 'Explore Data Science Topics',
    },
  ];
}
