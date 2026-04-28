import { NavigationLink } from './navigation.types';

export const DEFAULT_NAVIGATION_LINKS: NavigationLink[] = [
  {
    linkId: 'hai-to-configurator',
    sourceAppId: 'hai',
    targetAppId: 'system-configurator',
    type: 'nav',
    label: 'Build a System',
    path: '/build/new',
    position: 'primary',
    sortOrder: 1,
    iconName: 'computer',
  },
  {
    linkId: 'configurator-to-hai',
    sourceAppId: 'system-configurator',
    targetAppId: 'hai',
    type: 'nav',
    label: 'Home',
    path: '/',
    position: 'primary',
    sortOrder: 0,
  },
  {
    linkId: 'hai-footer-store',
    sourceAppId: 'hai',
    targetAppId: 'store',
    type: 'footer',
    label: 'Store',
    position: 'footer',
  },
  {
    linkId: 'hai-footer-opportunity-compass',
    sourceAppId: 'hai',
    targetAppId: 'opportunity-compass',
    type: 'footer',
    label: 'Opportunity Compass',
    position: 'footer',
  },
];
