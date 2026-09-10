import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import {
  BusinessAuthService,
  normalizeBusinessReturnTo,
} from '@optimistic-tanuki/business-data-access';

const AUTH_LOOP_PATHS = new Set([
  '/auth',
  '/login',
  '/register',
  '/owner/login',
  '/owner/register',
  '/client/login',
  '/client/register',
]);

function pathFromReturnUrl(returnUrl: string): string | null {
  try {
    return (
      decodeURIComponent(
        new URL(returnUrl, 'https://business-site.invalid').pathname
      ).replace(/\/+$/, '') || '/'
    );
  } catch {
    return null;
  }
}

function isSafeOwnerReturnUrl(
  returnUrl: string | null,
  siteSlug: string | null
): returnUrl is string {
  if (!returnUrl) return false;

  const path = pathFromReturnUrl(returnUrl);
  const ownerPrefix = siteSlug ? `/sites/${siteSlug}/owner` : '/owner';

  return (
    !!path &&
    !AUTH_LOOP_PATHS.has(path) &&
    !/^\/sites\/[^/]+\/(?:owner|client)\/(?:login|register)$/.test(path) &&
    (path === ownerPrefix || path.startsWith(`${ownerPrefix}/`))
  );
}

export const businessAuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(BusinessAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const siteSlug = route.paramMap.get('siteSlug');
  const fallback = siteSlug
    ? `/sites/${siteSlug}/owner/dashboard`
    : '/owner/dashboard';
  const returnUrl = isSafeOwnerReturnUrl(
    normalizeBusinessReturnTo(state.url),
    siteSlug
  )
    ? state.url
    : fallback;
  const loginRoute = siteSlug
    ? ['/sites', siteSlug, 'owner', 'login']
    : ['/owner/login'];

  return router.createUrlTree(loginRoute, {
    queryParams: { returnUrl },
  });
};
