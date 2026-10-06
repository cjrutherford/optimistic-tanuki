import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { from, map, of, startWith, switchMap } from 'rxjs';
import { type City, CommunityService } from '../../services/community.service';

export interface DaylightTown {
  /** The town page's slug, from `:slug`. */
  slug: Signal<string>;
  /** The town, once loaded; null while loading or when there is none. */
  city: Signal<City | null>;
  /** False until the lookup has finished, found or not. */
  loaded: Signal<boolean>;
  /** The civic-briefing locality, when Daylight covers the town. */
  localitySlug: Signal<string | null>;
}

/** The town named by the route's `:slug`, for the Daylight pages. Call in an injection context. */
export function injectDaylightTown(): DaylightTown {
  const communities = inject(CommunityService);
  const slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get('slug') ?? '')
    ),
    { requireSync: true }
  );
  const lookup = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      switchMap((params) => {
        const value = params.get('slug');
        if (!value) return of({ loaded: true, city: null });
        return from(communities.getCityBySlug(value)).pipe(
          map((city) => ({ loaded: true, city: city ?? null })),
          startWith({ loaded: false, city: null })
        );
      })
    ),
    { initialValue: { loaded: false, city: null as City | null } }
  );
  const city = computed(() => lookup().city);
  return {
    slug,
    city,
    loaded: computed(() => lookup().loaded),
    localitySlug: computed(() => city()?.localitySlug ?? null),
  };
}
