import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommunityDto } from '@optimistic-tanuki/ui-models';
import { CommunityService } from './community.service';

export interface Town {
  id: string;
  name: string;
  /** City and region when known, otherwise the locality type. */
  subtitle: string;
}

export type TownLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export const TOWN_STORAGE_KEY = 'owner-console.town';
export const TOWNS_PATH = '/dashboard/towns';

const TOWN_URL = /^\/dashboard\/towns\/([^/?#]+)/;

/** The town id in a `/dashboard/towns/:townId/...` URL, if any. */
export function townIdFromUrl(url: string): string | null {
  const match = TOWN_URL.exec(url);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** The same URL pointed at another town, keeping the tab and query. */
export function swapTownInUrl(url: string, townId: string): string | null {
  const match = TOWN_URL.exec(url);
  if (!match) {
    return null;
  }
  return `${TOWNS_PATH}/${encodeURIComponent(townId)}${url.slice(
    match[0].length
  )}`;
}

const toTown = (community: CommunityDto): Town => ({
  id: community.id,
  name: community.name,
  subtitle:
    [community.city, community.adminArea].filter(Boolean).join(', ') ||
    `${community.localityType ?? 'city'} record`,
});

function readStored(): string | null {
  try {
    return localStorage.getItem(TOWN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStored(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(TOWN_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(TOWN_STORAGE_KEY);
    }
  } catch {
    // Storage is blocked or full; the choice just will not survive a reload.
  }
}

/**
 * The town the owner is working in. Towns are the city records plus any
 * community with a city or town locality type. The URL wins over the stored
 * choice: opening `/dashboard/towns/:townId/...` selects that town.
 */
@Injectable({ providedIn: 'root' })
export class TownContextService {
  private readonly communities = inject(CommunityService);

  readonly towns = signal<Town[]>([]);
  readonly status = signal<TownLoadStatus>('idle');
  /** One of the two town sources failed, so the list may be incomplete. */
  readonly partial = signal(false);
  readonly selectedId = signal<string | null>(readStored());
  /** Town id named by the current URL, null off a town URL. */
  readonly urlTownId = signal<string | null>(null);

  readonly selected = computed(
    () => this.towns().find((town) => town.id === this.selectedId()) ?? null
  );
  /** The URL names a town that does not exist (only once towns have loaded). */
  readonly notFound = computed(() => {
    const id = this.urlTownId();
    return (
      this.status() === 'ready' &&
      !this.partial() &&
      id !== null &&
      !this.towns().some((town) => town.id === id)
    );
  });

  load(force = false): void {
    if (this.status() === 'loading' || (this.status() === 'ready' && !force)) {
      return;
    }
    this.status.set('loading');
    forkJoin({
      cities: this.communities.getCities().pipe(catchError(() => of(null))),
      communities: this.communities
        .getCommunities()
        .pipe(catchError(() => of(null))),
    }).subscribe(({ cities, communities }) => {
      if (cities === null && communities === null) {
        this.status.set('error');
        return;
      }
      this.partial.set(cities === null || communities === null);
      const byId = new Map<string, Town>();
      for (const city of cities ?? []) {
        byId.set(city.id, toTown(city));
      }
      for (const community of communities ?? []) {
        if (['city', 'town'].includes(community.localityType ?? '')) {
          byId.set(community.id, toTown(community));
        }
      }
      this.towns.set(
        [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
      );
      this.status.set('ready');
      this.settleSelection();
    });
  }

  /** Choose a town, or clear the choice with null. */
  select(id: string | null): void {
    this.selectedId.set(id);
    writeStored(id);
  }

  /** Apply the town named by a router URL; call on every navigation. */
  syncFromUrl(url: string): void {
    const id = townIdFromUrl(url);
    this.urlTownId.set(id);
    if (id && id !== this.selectedId()) {
      this.selectedId.set(id);
      if (this.towns().some((town) => town.id === id)) {
        writeStored(id);
      }
    }
  }

  /** After a load: remember a valid choice, drop a stale stored one. */
  private settleSelection(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    if (this.towns().some((town) => town.id === id)) {
      writeStored(id);
    } else if (this.urlTownId() === null) {
      this.select(null);
    }
  }
}
