export interface ServiceEntry {
  title: string;
  image: string;
  excerpt: string;
  primaryText: string;
  primaryHref: string;
  secondaryText: string;
  secondaryHref: string;
}

export const SERVICE_ENTRIES: ServiceEntry[] = [
  {
    title: 'Product and application delivery',
    image: 'assets/images/custom-app.png',
    excerpt:
      'Build customer-facing software that fits the product, the business behind it, and the team that has to keep shipping it.',
    primaryText: 'Explore work',
    primaryHref: '#work',
    secondaryText: 'Start a project',
    secondaryHref: '#contact',
  },
  {
    title: 'Technical direction and delivery recovery',
    image: 'assets/images/consulting.png',
    excerpt:
      'Step into work that has stalled or lost shape, clarify the path, and help the team get back to shipping with less thrash.',
    primaryText: 'Explore work',
    primaryHref: '#work',
    secondaryText: 'Start a project',
    secondaryHref: '#contact',
  },
  {
    title: 'Platform and systems architecture',
    image: 'assets/images/private-cloud.png',
    excerpt:
      'Make application and infrastructure decisions that hold up in practice and do not leave the team stuck with a confusing system later.',
    primaryText: 'Explore work',
    primaryHref: '#work',
    secondaryText: 'Start a project',
    secondaryHref: '#contact',
  },
  {
    title: 'Workflow design for real operations',
    image: 'assets/images/process-analytics.png',
    excerpt:
      'Design internal and customer-facing workflows around how people actually work instead of forcing everyone through generic process theater.',
    primaryText: 'Explore work',
    primaryHref: '#work',
    secondaryText: 'Start a project',
    secondaryHref: '#contact',
  },
];
