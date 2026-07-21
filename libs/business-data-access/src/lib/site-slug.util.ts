import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/**
 * Reactive `siteSlug` route param. Angular's default RouteReuseStrategy
 * reuses a component instance across navigations that hit the same route
 * config, even when params differ (e.g. `/sites/site-a` -> `/sites/site-b`).
 * Reading `route.snapshot.paramMap.get('siteSlug')` once in a field
 * initializer captures the slug at construction time and goes stale on
 * that kind of navigation. This tracks `paramMap` so it stays current.
 */
export function injectSiteSlugSignal() {
  const route = inject(ActivatedRoute, { optional: true });
  const initialValue = route?.snapshot.paramMap.get('siteSlug') ?? null;

  if (!route) {
    return () => initialValue;
  }

  return toSignal(
    route.paramMap.pipe(map((params) => params.get('siteSlug'))),
    { initialValue }
  );
}
