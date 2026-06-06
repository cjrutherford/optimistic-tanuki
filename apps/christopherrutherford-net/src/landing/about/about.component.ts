import { Component } from '@angular/core';

import { CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

interface CapabilityGroup {
  title: string;
  items: string[];
}

@Component({
  selector: 'app-about',
  imports: [HeadingComponent, CardComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly capabilityGroups: CapabilityGroup[] = [
    {
      title: 'Application delivery',
      items: [
        'Angular, React, TypeScript, Node.js, and NestJS',
        'Customer-facing workflows, dashboards, and product surfaces',
        'Information architecture and interaction design for dense applications',
      ],
    },
    {
      title: 'Platform and operations',
      items: [
        'Docker, Kubernetes, Azure, AWS, and Google Cloud',
        'Service boundaries, platform cleanup, and maintainable architecture',
        'Self-hosted, ownership-friendly systems and deployment workflows',
      ],
    },
    {
      title: 'Data and workflow systems',
      items: [
        'PostgreSQL, MySQL, MongoDB, and Redis',
        'Commerce, finance, media, community, and planning domains',
        'Workflow design that matches how teams and users actually operate',
      ],
    },
  ];
}
