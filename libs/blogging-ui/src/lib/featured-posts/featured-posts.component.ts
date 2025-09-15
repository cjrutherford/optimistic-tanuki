import { Component, Input, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlogPostCardComponent } from '../blog-post/card.component';
import { trigger, transition, style, animate } from '@angular/animations';

export type PostDefinition = {
  title: string;
  bannerImage: string;
  excerpt: string;
  authorName: string;
  publishDate: string;
  readMoreLink: string;
}

@Component({
  selector: 'lib-featured-posts',
  imports: [CommonModule, BlogPostCardComponent],
  templateUrl: './featured-posts.component.html',
  styleUrls: ['./featured-posts.component.scss'],
  animations: [
    trigger('carouselAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('0.5s ease', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('0.5s ease', style({ opacity: 0, transform: 'translateX(-100%)' }))
      ])
    ])
  ],
  host: {
    '[style.--visible-items]': 'visibleItems'
  }
})
export class FeaturedPostsComponent {
  @Input() featuredPosts: PostDefinition[] = [
    {
      title: 'Understanding Microservices Architecture',
      bannerImage: 'https://picsum.photos/id/1011/800/400',
      excerpt: 'A deep dive into the principles and benefits of microservices.',
      authorName: 'Jane Doe',
      publishDate: '2024-05-10',
      readMoreLink: '/blog/microservices-architecture'
    },
    {
      title: 'Nx Workspace Best Practices',
      bannerImage: 'https://picsum.photos/id/1025/800/400',
      excerpt: 'Tips and tricks for managing large Nx monorepos efficiently.',
      authorName: 'John Smith',
      publishDate: '2024-05-15',
      readMoreLink: '/blog/nx-workspace-best-practices'
    },
    {
      title: 'Optimizing Angular Applications',
      bannerImage: 'https://picsum.photos/id/1035/800/400',
      excerpt: 'Performance strategies for scalable Angular apps.',
      authorName: 'Emily Chen',
      publishDate: '2024-05-20',
      readMoreLink: '/blog/angular-optimization'
    },
    {
      title: 'Docker Compose for Local Development',
      bannerImage: 'https://picsum.photos/id/1043/800/400',
      excerpt: 'How to use Docker Compose to streamline your dev workflow.',
      authorName: 'Carlos Ruiz',
      publishDate: '2024-05-22',
      readMoreLink: '/blog/docker-compose-local-dev'
    },
    {
      title: 'Getting Started with PostgreSQL',
      bannerImage: 'https://picsum.photos/id/1052/800/400',
      excerpt: 'A beginner’s guide to setting up and using PostgreSQL.',
      authorName: 'Priya Patel',
      publishDate: '2024-05-25',
      readMoreLink: '/blog/getting-started-postgresql'
    },
    {
      title: 'Authentication Strategies in Modern Web Apps',
      bannerImage: 'https://picsum.photos/id/1062/800/400',
      excerpt: 'Exploring secure authentication patterns for web applications.',
      authorName: 'Alex Kim',
      publishDate: '2024-05-28',
      readMoreLink: '/blog/authentication-strategies'
    },
    {
      title: 'Building Reusable UI Components',
      bannerImage: 'https://picsum.photos/id/1074/800/400',
      excerpt: 'How to create and share UI components across projects.',
      authorName: 'Sara Lee',
      publishDate: '2024-06-01',
      readMoreLink: '/blog/reusable-ui-components'
    },
    {
      title: 'Continuous Integration with Nx Cloud',
      bannerImage: 'https://picsum.photos/id/1084/800/400',
      excerpt: 'Leveraging Nx Cloud for faster and more reliable CI pipelines.',
      authorName: 'Mohammed Al-Farsi',
      publishDate: '2024-06-03',
      readMoreLink: '/blog/nx-cloud-ci'
    },
    {
      title: 'Monorepo vs Polyrepo: Pros and Cons',
      bannerImage: 'https://picsum.photos/id/109/800/400',
      excerpt: 'Comparing monorepo and polyrepo approaches for code organization.',
      authorName: 'Linda Nguyen',
      publishDate: '2024-06-05',
      readMoreLink: '/blog/monorepo-vs-polyrepo'
    },
    {
      title: 'Live Reloading in Dockerized Environments',
      bannerImage: 'https://picsum.photos/id/110/800/400',
      excerpt: 'Techniques for enabling live reload in Docker development setups.',
      authorName: 'Tom Becker',
      publishDate: '2024-06-07',
      readMoreLink: '/blog/live-reload-docker'
    }
  ];
  @Input() visibleItems = 3;

  currentIndex = signal(0);

  get visiblePosts(): Signal<PostDefinition[]> {
    return signal(this.featuredPosts.slice(this.currentIndex(), this.currentIndex() + this.visibleItems));
  }

  next(): void {
    if (this.currentIndex() < this.featuredPosts.length - this.visibleItems) {
      this.currentIndex.set(this.currentIndex() + 1);
    }
  }

  prev(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.set(this.currentIndex() - 1);
    }
  }
}
