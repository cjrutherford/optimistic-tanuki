import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  LocalDirectoryCoverage,
  LocalDirectoryListing,
  LocalDirectorySourceFreshness,
  readCoverage,
  readSourceFreshness,
} from '@optimistic-tanuki/directory-ui';
import { firstValueFrom } from 'rxjs';

export interface DirectoryQuery {
  q: string;
  category: string;
  adult: boolean;
  /** Opaque cursor from a previous page; empty for the first page. */
  cursor: string;
}

export interface DirectoryPage {
  listings: LocalDirectoryListing[];
  hasMore: boolean;
  nextCursor: string | null;
  sourceFreshness: LocalDirectorySourceFreshness | null;
  coverage: LocalDirectoryCoverage | null;
}

/** Everything needed to redraw a results page without asking again (browser Back, returning from detail). */
export type DirectorySnapshot = DirectoryPage;

/** A request failed. `status` is the HTTP status when there was one; no server detail is ever kept. */
export class DirectoryRequestError extends Error {
  constructor(readonly status: number | null) {
    super('Local directory unavailable');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_SNAPSHOTS = 20;

function readListing(raw: unknown): LocalDirectoryListing | null {
  const v = raw as Partial<LocalDirectoryListing> | null;
  if (!v || typeof v !== 'object' || typeof v.name !== 'string') return null;
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : [];
  const coords = v.coordinates;
  return {
    name: v.name,
    category: typeof v.category === 'string' ? v.category : 'other',
    attribution: strings(v.attribution),
    notices: strings(v.notices),
    ...(typeof v.id === 'string' && UUID.test(v.id) ? { id: v.id } : {}),
    ...(typeof v.reference === 'string' && v.reference
      ? { reference: v.reference }
      : {}),
    ...(Array.isArray(v.termsUrls) ? { termsUrls: strings(v.termsUrls) } : {}),
    ...(typeof v.website === 'string' && v.website
      ? { website: v.website }
      : {}),
    ...(typeof v.phone === 'string' && v.phone ? { phone: v.phone } : {}),
    ...(typeof v.address === 'string' && v.address
      ? { address: v.address }
      : {}),
    ...(coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
      ? { coordinates: { lat: coords.lat, lng: coords.lng } }
      : {}),
  };
}

/** Public directory data in cursor mode. HTTP lives here; the shared UI components never fetch. */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);
  private snapshots = new Map<string, DirectorySnapshot>();

  private base(townId: string): string {
    return `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings`;
  }

  async getPage(townId: string, query: DirectoryQuery): Promise<DirectoryPage> {
    const params = new URLSearchParams({ pagination: 'cursor' });
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.q) params.set('q', query.q);
    if (query.category) params.set('category', query.category);
    if (query.adult) params.set('adult', '1');
    let result: Partial<DirectoryPage> & {
      listings?: unknown;
      nextCursor?: unknown;
      sourceFreshness?: unknown;
      coverage?: unknown;
    };
    try {
      result = await firstValueFrom(
        this.http.get<typeof result>(`${this.base(townId)}?${params}`)
      );
    } catch (error) {
      throw new DirectoryRequestError(
        error instanceof HttpErrorResponse ? error.status : null
      );
    }
    if (!result || !Array.isArray(result.listings)) {
      throw new DirectoryRequestError(null);
    }
    return {
      listings: result.listings
        .map(readListing)
        .filter((l): l is LocalDirectoryListing => l !== null),
      hasMore: result.hasMore === true,
      nextCursor:
        typeof result.nextCursor === 'string' && result.nextCursor
          ? result.nextCursor
          : null,
      sourceFreshness: readSourceFreshness(result.sourceFreshness) ?? null,
      coverage: readCoverage(result.coverage) ?? null,
    };
  }

  /** `null` means the reference is unknown or expired (HTTP 404). Anything else that fails throws. */
  async getListing(
    townId: string,
    reference: string,
    adult: boolean
  ): Promise<LocalDirectoryListing | null> {
    try {
      const raw = await firstValueFrom(
        this.http.get<unknown>(
          `${this.base(townId)}/${encodeURIComponent(reference)}${
            adult ? '?adult=1' : ''
          }`
        )
      );
      const listing = readListing(raw);
      if (!listing) throw new DirectoryRequestError(null);
      return listing;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      if (error instanceof DirectoryRequestError) throw error;
      throw new DirectoryRequestError(
        error instanceof HttpErrorResponse ? error.status : null
      );
    }
  }

  snapshotKey(townId: string, query: DirectoryQuery): string {
    return JSON.stringify([
      townId,
      query.q,
      query.category,
      query.adult,
      query.cursor,
    ]);
  }

  saveSnapshot(key: string, snapshot: DirectorySnapshot): void {
    this.snapshots.delete(key);
    this.snapshots.set(key, snapshot);
    if (this.snapshots.size > MAX_SNAPSHOTS) {
      const oldest = this.snapshots.keys().next().value;
      if (oldest !== undefined) this.snapshots.delete(oldest);
    }
  }

  getSnapshot(key: string): DirectorySnapshot | undefined {
    return this.snapshots.get(key);
  }
}
