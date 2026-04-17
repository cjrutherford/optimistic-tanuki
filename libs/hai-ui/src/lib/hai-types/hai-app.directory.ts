import { HaiAppLink } from './hai-app.config';

export const HAI_APP_DIRECTORY: HaiAppLink[] = [
  {
    appId: 'hai',
    name: 'HAI',
    tagline: 'Software, cloud, and personal-cloud systems.',
    href: '/hai',
  },
  {
    appId: 'digital-grange',
    name: 'Digital Grange',
    tagline: 'Digital homesteading for owned, calm computing.',
    href: '/digital-grange',
  },
  {
    appId: 'hai-computer',
    name: 'HAI Computer',
    tagline: 'Pre-configured personal cloud and homelab systems.',
    href: '/hai-computer',
  },
  {
    appId: 'towne-square',
    name: 'Towne Square',
    tagline: 'Neighborhood commerce and local community tools.',
    href: '/towne-square',
  },
  {
    appId: 'forge-of-will',
    name: 'Forge of Will',
    tagline: 'Intentional productivity and personal systems.',
    href: '/forge-of-will',
  },
  {
    appId: 'optimistic-tanuki',
    name: 'Optimistic Tanuki',
    tagline: 'The broader HAI social and utility ecosystem.',
    href: '/optimistic-tanuki',
  },
];

export function getHaiAppLinks(currentAppId?: string): HaiAppLink[] {
  return HAI_APP_DIRECTORY.filter((app) => app.appId !== currentAppId);
}
