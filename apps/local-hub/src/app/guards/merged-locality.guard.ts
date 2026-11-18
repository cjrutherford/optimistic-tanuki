import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CommunityService } from '../services/community.service';

/**
 * A locality the owner merged into another keeps its slug in Social, so old links and bookmarks still reach the
 * route, and a renamed locality keeps its old slug as a redirect. This sends them to the same page of the town that absorbed it. A failed lookup never blocks navigation.
 */
export const mergedLocalityRedirectGuard: CanActivateFn = async (
  route,
  state
) => {
  const slug = route.paramMap.get('slug');
  if (!slug) return true;
  const communities = inject(CommunityService);
  const router = inject(Router);
  try {
    const community = await communities.getCommunityBySlug(slug);
    const target = community?.mergedIntoSlug ?? community?.redirectToSlug;
    if (!target) return true;
    const prefix = `/city/${slug}`;
    const cut = state.url.search(/[?#]/);
    const path = cut === -1 ? state.url : state.url.slice(0, cut);
    const suffix = cut === -1 ? '' : state.url.slice(cut);
    if (!path.startsWith(prefix)) return true;
    return router.parseUrl(
      `/city/${target}${path.slice(prefix.length)}${suffix}`
    );
  } catch {
    return true;
  }
};
