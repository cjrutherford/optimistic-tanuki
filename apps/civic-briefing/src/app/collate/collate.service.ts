import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CivicItemSchema,
  EditionItemSchema,
  isEditoriallyEligibleBody,
  isItemInEvidenceRange,
  itemEvidenceLocalDate,
  type CivicKind,
  type Cluster,
} from '@optimistic-tanuki/civic-core';

/**
 * Gathers an edition's evidence and groups it by kind and topic.
 *
 * Reading starts from the edition projection rather than the intake table, so
 * an item the inclusion rule withheld cannot reach a briefing even if a
 * caller skips the normal orchestration. The rule version is required for the
 * same reason: without one there is no projection to read, and returning
 * everything would be worse than returning nothing.
 */

export interface CollateRequest {
  localitySlug: string;
  ruleVersion?: string;
  /** Context window start; undated rows are kept for continuity. */
  since?: string;
  contextEnd?: string;
  /** The daily window: news and alerts must fall inside it to count as fresh. */
  publishedSince?: string;
  publishedEnd?: string;
  timezone?: string;
}

/** Records the town governs by come before what merely happened in it. */
const KIND_ORDER: Record<string, number> = {
  meeting: 0,
  legislation: 1,
  permit: 2,
  alert: 3,
  'open-data': 4,
  news: 5,
};

@Injectable()
export class CollateService {
  constructor(
    @InjectRepository(EditionItemSchema)
    private readonly editionItems: Repository<Record<string, any>>,
    @InjectRepository(CivicItemSchema)
    private readonly items: Repository<Record<string, any>>
  ) {}

  async collate(request: CollateRequest): Promise<Cluster[]> {
    const ruleVersion = request.ruleVersion ?? null;
    if (!ruleVersion) return [];
    const timezone = request.timezone ?? 'UTC';

    const rows = await this.editionItems.find({
      where: {
        localitySlug: request.localitySlug,
        decision: 'include',
        ruleVersion,
      },
      order: { id: 'ASC' },
    });
    const ids = [...new Set(rows.map((row) => row['civicItemId'] as number))];
    if (!ids.length) return [];

    const evidence = (await this.items.find({ where: { id: In(ids) } }))
      .filter((item) => {
        if (
          !isEditoriallyEligibleBody(
            `${item['title']} ${item['body']}`,
            item['kind']
          )
        )
          return false;
        if (!request.since) return true;
        const day = itemEvidenceLocalDate(item as never, timezone);
        // Undated rows stay for continuity; the daily filter below still
        // excludes them unless they carry observation or content dates.
        return (
          day === null ||
          (day >= request.since.slice(0, 10) &&
            (!request.contextEnd || day < request.contextEnd))
        );
      })
      .sort(
        (a, b) =>
          (a['eventDate'] ?? '￿').localeCompare(b['eventDate'] ?? '￿') ||
          (b['publishedAt'] ?? '').localeCompare(a['publishedAt'] ?? '') ||
          (a['id'] as number) - (b['id'] as number)
      );

    const fresh = request.publishedSince
      ? evidence.filter((item) =>
          isItemInEvidenceRange(
            item as never,
            request.publishedSince!,
            request.publishedEnd ?? '9999-12-31',
            timezone
          )
        )
      : evidence;

    const clusters = new Map<string, Cluster>();
    for (const item of fresh) {
      const topics = parseTopics(item['topics']);
      const topic = topics[0] ?? 'general';
      const key = `${item['kind']}|${topic}`;
      const cluster = clusters.get(key) ?? {
        kind: item['kind'] as CivicKind,
        topic,
        items: [],
      };
      cluster.items.push(item as never);
      clusters.set(key, cluster);
    }
    return [...clusters.values()].sort(
      (a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9)
    );
  }
}

function parseTopics(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  try {
    return JSON.parse(value as string) as string[];
  } catch {
    return [];
  }
}
