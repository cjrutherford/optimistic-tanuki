import { AppShellNavLink } from '@optimistic-tanuki/navigation-ui';

/** The full site tree, shown in the navigation drawer. */
export const SITE_NAVIGATION: AppShellNavLink[] = [
  { label: 'Home', route: '/', exact: true },
  {
    label: 'Solutions',
    children: [
      {
        label: 'Private Cloud',
        route: '/private-cloud',
        children: [
          { label: 'For your home', route: '/private-cloud/home' },
          { label: 'For organizations', route: '/private-cloud/organizations' },
          {
            label: 'Open-source stack',
            route: '/private-cloud/open-source-stack',
          },
          { label: 'Assessment', route: '/private-cloud/assessment' },
        ],
      },
      { label: 'Turn-key Appliances', route: '/turn-key-appliances' },
      { label: 'Software Stacks', route: '/software-stacks' },
      { label: 'Custom Software', route: '/custom-software' },
      { label: 'Partners', route: '/partners' },
    ],
  },
  { label: 'Cost Comparison', route: '/cost-comparison' },
  { label: 'How We Work', route: '/how-we-work' },
  { label: 'Contact', route: '/contact' },
];

/** The few links that sit directly in the desktop header. */
export const HEADER_LINKS: AppShellNavLink[] = [
  { label: 'Private Cloud', route: '/private-cloud' },
  { label: 'Cost Comparison', route: '/cost-comparison' },
  { label: 'How We Work', route: '/how-we-work' },
  { label: 'Contact', route: '/contact' },
];
