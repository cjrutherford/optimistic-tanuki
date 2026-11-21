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
import {
  CreateListingReportRequest,
  ListingReportReceiptStatus,
} from '@optimistic-tanuki/social-contracts';
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
/**
 * A snapshot only exists so Back and returning from a detail page redraw
 * without a flash. It must not outlive a suppression or withdrawal for long,
 * so after this it is dropped and the page is fetched again.
 */
export const SNAPSHOT_TTL_MS = 60_000;

interface StoredSnapshot {
  snapshot: DirectorySnapshot;
  savedAt: number;
}

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
  private snapshots = new Map<string, StoredSnapshot>();

  private base(townId: string): string {
    return `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings`;
  }

  /**
   * Where a resident downloads a town's listings. The browser follows this as
   * a plain attachment link, so nothing is buffered in the app. What the file
   * contains is decided by Directory, not here.
   */
  publicExportUrl(townId: string, format: 'csv' | 'jsonl'): string {
    return `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/public-export?format=${format}`;
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
        // Gone (suppressed, withdrawn or expired): no remembered page may show it again.
        this.forgetListing(townId, reference, adult);
        return null;
      }
      if (error instanceof DirectoryRequestError) throw error;
      throw new DirectoryRequestError(
        error instanceof HttpErrorResponse ? error.status : null
      );
    }
  }

  /** Files a public report. Resolves to the receipt code; rejects with a DirectoryRequestError carrying only the HTTP status. */
  async createReport(
    townId: string,
    body: CreateListingReportRequest
  ): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ receipt?: unknown }>(
          `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
            townId
          )}/listing-reports`,
          body
        )
      );
      if (typeof res?.receipt !== 'string' || !res.receipt) {
        throw new DirectoryRequestError(null);
      }
      return res.receipt;
    } catch (error) {
      if (error instanceof DirectoryRequestError) throw error;
      throw new DirectoryRequestError(
        error instanceof HttpErrorResponse ? error.status : null
      );
    }
  }

  /** `null` means no report has that code (HTTP 404). */
  async getReportStatus(
    receipt: string
  ): Promise<ListingReportReceiptStatus | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<Partial<ListingReportReceiptStatus>>(
          `${this.apiBaseUrl}/directory/listing-reports/${encodeURIComponent(
            receipt
          )}`
        )
      );
      if (
        !res ||
        typeof res.status !== 'string' ||
        typeof res.createdAt !== 'string'
      ) {
        throw new DirectoryRequestError(null);
      }
      return res as ListingReportReceiptStatus;
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
    this.snapshots.set(key, { snapshot, savedAt: Date.now() });
    if (this.snapshots.size > MAX_SNAPSHOTS) {
      const oldest = this.snapshots.keys().next().value;
      if (oldest !== undefined) this.snapshots.delete(oldest);
    }
  }

  /** A snapshot older than the TTL is dropped and reads as absent, so the caller refetches. */
  getSnapshot(key: string): DirectorySnapshot | undefined {
    const stored = this.snapshots.get(key);
    if (!stored) return undefined;
    if (Date.now() - stored.savedAt >= SNAPSHOT_TTL_MS) {
      this.snapshots.delete(key);
      return undefined;
    }
    return stored.snapshot;
  }

  /**
   * Removes a listing from every remembered page of the same town and adult
   * setting (a reference is only valid under the setting it was issued for).
   */
  forgetListing(townId: string, reference: string, adult: boolean): void {
    for (const [key, stored] of this.snapshots) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(key);
      } catch {
        continue;
      }
      if (
        !Array.isArray(parsed) ||
        parsed[0] !== townId ||
        parsed[3] !== adult
      ) {
        continue;
      }
      const listings = stored.snapshot.listings;
      const hit = listings.find((l) => l.reference === reference);
      if (!hit) continue;
      const kept = listings.filter(
        (l) => l !== hit && !(hit.id && l.id === hit.id)
      );
      this.snapshots.set(key, {
        ...stored,
        snapshot: { ...stored.snapshot, listings: kept },
      });
    }
  }
}
