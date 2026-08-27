import { ParamMap } from '@angular/router';

export type LocalityRouteContext = {
  slug: string;
  baseSegments: string[];
};

/**
 * Normalizes both locality route families into the slug used by the API and
 * the route segments that should be reused for navigation.
 */
export function localityRouteContext(params: ParamMap): LocalityRouteContext {
  const citySlug = params.get('slug')?.trim() ?? '';
  if (citySlug) {
    return { slug: citySlug, baseSegments: ['/city', citySlug] };
  }

  const communitySlug = params.get('communitySlug')?.trim() ?? '';
  if (communitySlug) {
    return { slug: communitySlug, baseSegments: ['/c', communitySlug] };
  }

  return { slug: '', baseSegments: [] };
}
