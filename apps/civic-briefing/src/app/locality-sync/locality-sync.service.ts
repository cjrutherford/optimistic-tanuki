import { Logger } from '@nestjs/common';
import type { LocalityRow } from '@optimistic-tanuki/civic-core';
import { In, type Repository } from 'typeorm';
import {
  batchPeers,
  communityToLocality,
  stateRootRow,
  usRootRow,
  type LocalityDefaults,
} from './community-to-locality';
import type { LocalityCommunitySource } from './social-locality.client';
import { US_ROOT_SLUG, stateRootSlug } from './us-states';

export interface LocalitySyncSkip {
  communityId: string;
  slug?: string;
  reason: string;
}

export interface LocalitySyncSummary {
  created: number;
  updated: number;
  deactivated: number;
  skipped: LocalitySyncSkip[];
}

export const DEFAULT_LOCALITY_SYNC_INTERVAL_MS = 60 * 60 * 1000;

/** Columns the sync owns: a change to any of them counts as an update. */
const SYNCED_FIELDS = [
  'name',
  'state',
  'timezone',
  'kind',
  'parents',
  'edition',
  'communityId',
] as const;

function sameNumber(a: number | null | undefined, b: number): boolean {
  return a !== null && a !== undefined && Math.abs(Number(a) - b) < 1e-4;
}

/** The fields of `next` that differ from `existing`. */
function changes(
  existing: LocalityRow,
  next: LocalityRow
): Partial<LocalityRow> {
  const diff: Record<string, unknown> = {};
  for (const field of SYNCED_FIELDS) {
    if ((existing[field] ?? null) !== (next[field] ?? null)) {
      diff[field] = next[field] ?? null;
    }
  }
  if (!sameNumber(existing.lat, next.lat)) diff['lat'] = next.lat;
  if (!sameNumber(existing.lon, next.lon)) diff['lon'] = next.lon;
  if (existing.active === false) diff['active'] = true;
  // Topics, cadence and exclude phrases are filled in once and then left
  // alone, so a later tuning of a town is not undone by the next sync.
  for (const field of ['topics', 'cadence', 'excludePhrases'] as const) {
    if (existing[field] == null && next[field] != null) {
      diff[field] = next[field];
    }
  }
  return diff as Partial<LocalityRow>;
}

/**
 * Keeps civic-briefing's `localities` in step with social's locality
 * communities. Fetch, map, upsert by communityId then slug; communities that
 * are gone are deactivated, never deleted. Idempotent: a second run with the
 * same input changes nothing but `syncedAt`.
 */
export class LocalitySyncService {
  private readonly logger = new Logger(LocalitySyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly source: LocalityCommunitySource,
    private readonly localities: Repository<LocalityRow>,
    private readonly defaults: LocalityDefaults,
    private readonly now: () => Date = () => new Date()
  ) {}

  async sync(): Promise<LocalitySyncSummary> {
    const communities = await this.source.listLocalityCommunities();
    const syncedAt = this.now();
    const summary: LocalitySyncSummary = {
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: [],
    };
    const skip = (communityId: string, reason: string, slug?: string) => {
      summary.skipped.push({ communityId, slug, reason });
      this.logger.warn(
        `skipped community ${communityId}${slug ? ` (${slug})` : ''}: ${reason}`
      );
    };

    const peers = batchPeers(communities);
    const rootSlugs = new Set<string>([US_ROOT_SLUG]);
    const roots = new Map<string, LocalityRow>([[US_ROOT_SLUG, usRootRow()]]);
    const taken = new Set<string>();
    const seenIds = new Set(communities.map((c) => c.id));

    for (const community of communities) {
      const mapped = communityToLocality(community, this.defaults, { peers });
      if (!mapped.ok) {
        skip(community.id, mapped.reason, community.slug ?? undefined);
        continue;
      }
      const { row, state } = mapped;
      const rootSlug = stateRootSlug(state);
      if (row.slug === US_ROOT_SLUG || row.slug === rootSlug) {
        skip(community.id, 'slug collides with a root locality', row.slug);
        continue;
      }
      if (taken.has(row.slug)) {
        skip(community.id, 'duplicate slug in this sync', row.slug);
        continue;
      }
      const byCommunity = await this.localities.findOneBy({
        communityId: community.id,
      });
      if (byCommunity && byCommunity.slug !== row.slug) {
        // Downstream rows are keyed by slug; renaming needs a re-key.
        skip(
          community.id,
          `slug change refused (${byCommunity.slug} -> ${row.slug})`,
          row.slug
        );
        taken.add(byCommunity.slug);
        continue;
      }
      const existing =
        byCommunity ?? (await this.localities.findOneBy({ slug: row.slug }));
      if (existing?.communityId && existing.communityId !== community.id) {
        skip(
          community.id,
          `slug already belongs to community ${existing.communityId}`,
          row.slug
        );
        continue;
      }
      taken.add(row.slug);
      if (!roots.has(rootSlug)) roots.set(rootSlug, stateRootRow(state));
      rootSlugs.add(rootSlug);

      if (!existing) {
        await this.localities.insert({ ...row, syncedAt });
        summary.created += 1;
        continue;
      }
      const diff = changes(existing, row);
      const changed = Object.keys(diff).length > 0;
      await this.localities.update(
        { slug: existing.slug },
        { ...diff, syncedAt }
      );
      if (changed) summary.updated += 1;
    }

    await this.ensureRoots(roots, syncedAt);

    // An empty list is more likely a failure upstream than every town
    // vanishing; deactivate nothing then.
    if (communities.length === 0) {
      this.logger.warn('social returned no communities; deactivating nothing');
    } else {
      const stale = (
        await this.localities.find({
          where: { active: true },
          select: ['slug', 'communityId'],
        })
      ).filter((row) => row.communityId && !seenIds.has(row.communityId));
      if (stale.length) {
        await this.localities.update(
          { slug: In(stale.map((row) => row.slug)) },
          { active: false, syncedAt }
        );
        summary.deactivated = stale.length;
      }
    }

    this.logger.log(
      `locality sync: ${summary.created} created, ${summary.updated} updated, ` +
        `${summary.deactivated} deactivated, ${summary.skipped.length} skipped`
    );
    return summary;
  }

  /** Creates the `US` root and any state roots that are missing; existing roots are left as they are. */
  private async ensureRoots(
    roots: Map<string, LocalityRow>,
    syncedAt: Date
  ): Promise<void> {
    const existing = new Set(
      (
        await this.localities.find({
          where: { slug: In([...roots.keys()]) },
          select: ['slug'],
        })
      ).map((row) => row.slug)
    );
    for (const root of roots.values()) {
      if (!existing.has(root.slug)) {
        await this.localities.insert({ ...root, syncedAt });
      }
    }
  }

  /** Runs `sync` now and then every `intervalMs`. A failed run is logged and the next one still happens. */
  start(
    intervalMs: number = DEFAULT_LOCALITY_SYNC_INTERVAL_MS,
    onSynced?: (summary: LocalitySyncSummary) => void | Promise<void>
  ): void {
    if (this.timer) return;
    const run = async () => {
      if (this.running) return;
      this.running = true;
      try {
        const summary = await this.sync();
        await onSynced?.(summary);
      } catch (error) {
        this.logger.error(
          `locality sync failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        this.running = false;
      }
    };
    void run();
    this.timer = setInterval(run, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

/** LOCALITY_SYNC_INTERVAL_MS, default 1h. */
export function localitySyncIntervalMs(
  env: Record<string, string | undefined> = process.env
): number {
  const value = Number(env['LOCALITY_SYNC_INTERVAL_MS']);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LOCALITY_SYNC_INTERVAL_MS;
}
