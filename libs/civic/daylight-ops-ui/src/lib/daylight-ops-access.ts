import { inject, InjectionToken } from '@angular/core';
import { OptomisitcTanukiAPIService as CivicAPIService } from '@optimistic-tanuki/civic-briefing-data-access';
import { map, type Observable } from 'rxjs';

/**
 * The operator permissions the panels are gated on. The gateway checks every
 * call again; this only decides which panels to show.
 */
export const DAYLIGHT_OPERATOR_PERMISSIONS = [
  'town.configure',
  'sources.read',
  'sources.manage',
  'density.read',
  'takedown.manage',
  'official.verify',
  'community.maintain',
] as const;

/** Which town the page is about. Without one it covers every town. */
export interface DaylightTownFilter {
  slug?: string | null;
  name?: string | null;
}

/** Returns the permission names the signed-in account holds. */
export type DaylightOpsAccess = () => Observable<readonly string[]>;

/**
 * How an app learns the operator's permissions. The default asks local-hub's
 * `/me` route, which reads local-hub roles. Owner-console provides its own,
 * because its owner holds owner-console roles instead.
 */
export const DAYLIGHT_OPS_ACCESS = new InjectionToken<DaylightOpsAccess>(
  'DAYLIGHT_OPS_ACCESS',
  {
    providedIn: 'root',
    factory: () => {
      const civic = inject(CivicAPIService);
      return () => civic.me().pipe(map((reply) => reply.data.permissions));
    },
  }
);
