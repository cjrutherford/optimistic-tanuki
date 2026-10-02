import type {
  CorpusDocument,
  PrimaryRecord,
  SubjectOption,
} from '@optimistic-tanuki/civic-community';
import { DataSource } from 'typeorm';

/** Below this many words an article is a headline or a teaser, and copying it is not a repost. */
const MIN_ARTICLE_WORDS = 60;
/** How far back a meeting is offered for attachment. */
export const MEETING_DAYS = 120;
/** How much of a record is compared with a report. */
const RECORD_EXCERPT = 1_200;
/** The desk a subject belongs to when its source does not say. */
export const DEFAULT_TOPIC = 'government';

/**
 * What the pipeline has published, for civic-contributions (ported from the
 * POC community service's CorpusService, which read this database directly).
 * Only news goes to the copying index: the quotation rule protects
 * publishers' work, and agendas and minutes are public records.
 */
export class CorpusQueryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly now: () => Date = () => new Date()
  ) {}

  async news(): Promise<CorpusDocument[]> {
    // The source's own name, not the item's publisher column: for a
    // newspaper's feed that column often holds the reporter's byline.
    const rows = (await this.dataSource.query(
      `SELECT c.id, c."sourceId", c.title, c.body,
              COALESCE(s.name, c.publisher, c."sourceId") AS publisher, c."canonicalUrl"
       FROM civic_items c LEFT JOIN sources s ON s.id = c."sourceId"
       WHERE c.kind = 'news' AND length(c.body) > 0
       ORDER BY c.id`
    )) as {
      id: number;
      sourceId: string;
      title: string;
      body: string;
      publisher: string;
      canonicalUrl: string | null;
    }[];
    const documents: CorpusDocument[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.body.split(/\s+/u).length < MIN_ARTICLE_WORDS) continue;
      const key = row.canonicalUrl ?? `${row.sourceId}:${row.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push({
        id: `${row.sourceId}:${row.id}`,
        publisher: row.publisher,
        title: row.title,
        body: row.body,
        url: row.canonicalUrl,
      });
    }
    return documents;
  }

  /** Recent meetings and current stories in a town, for a contribution to attach to. */
  async subjects(localitySlug: string): Promise<SubjectOption[]> {
    const since = new Date(this.now().getTime() - MEETING_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const meetings = (await this.dataSource.query(
      `SELECT id, title, COALESCE("eventDate", "publishedAt") AS day, "canonicalUrl"
       FROM civic_items
       WHERE kind = 'meeting' AND "localitySlug" = $1
         AND COALESCE("eventDate", "publishedAt") >= $2
       ORDER BY day DESC, id DESC LIMIT 40`,
      [localitySlug, since]
    )) as {
      id: number;
      title: string;
      day: string | null;
      canonicalUrl: string | null;
    }[];
    const stories = (await this.dataSource.query(
      `SELECT s.id, s.title, s."lastEvidenceDate"
       FROM edition_stories e JOIN canonical_stories s ON s.id = e."canonicalStoryId"
       WHERE e."localitySlug" = $1
       ORDER BY s."lastEvidenceDate" DESC NULLS LAST, s.id DESC LIMIT 40`,
      [localitySlug]
    )) as { id: number; title: string; lastEvidenceDate: string | null }[];
    return [
      ...meetings.map(
        (row): SubjectOption => ({
          kind: 'meeting',
          ref: String(row.id),
          title: row.title,
          date: row.day?.slice(0, 10) ?? null,
          url: row.canonicalUrl,
        })
      ),
      ...stories.map(
        (row): SubjectOption => ({
          kind: 'story',
          ref: String(row.id),
          title: row.title,
          date: row.lastEvidenceDate?.slice(0, 10) ?? null,
          url: null,
        })
      ),
    ];
  }

  /**
   * The subject area a contribution belongs to: the source's desk for a
   * meeting, the desk of a story's most recent evidence, else government.
   */
  async topicFor(
    localitySlug: string,
    subject: { kind: string; ref: string | null }
  ): Promise<string> {
    if (subject.kind === 'meeting' && subject.ref) {
      const rows = (await this.dataSource.query(
        `SELECT s.desk FROM civic_items c JOIN sources s ON s.id = c."sourceId"
         WHERE c.id = $1 AND c."localitySlug" = $2`,
        [Number(subject.ref), localitySlug]
      )) as { desk: string | null }[];
      if (rows[0]?.desk) return rows[0].desk;
    }
    if (subject.kind === 'story' && subject.ref) {
      const rows = (await this.dataSource.query(
        `SELECT s.desk FROM canonical_story_items l
         JOIN civic_items c ON c.id = l."civicItemId"
         JOIN sources s ON s.id = c."sourceId"
         WHERE l."canonicalStoryId" = $1 AND s.desk IS NOT NULL
         ORDER BY l.id DESC LIMIT 1`,
        [Number(subject.ref)]
      )) as { desk: string | null }[];
      if (rows[0]?.desk) return rows[0].desk;
    }
    return DEFAULT_TOPIC;
  }

  /**
   * What the town's sources published on or after a day. The town's own
   * documents are `record`; a publisher's article is `news`, which counts for
   * less because it may rest on the same account the report did.
   */
  async recordsSince(
    localitySlug: string,
    day: string,
    limit = 200
  ): Promise<PrimaryRecord[]> {
    const rows = (await this.dataSource.query(
      `SELECT c.id, c.kind, c.title, c.body,
              COALESCE(c."eventDate", c."publishedAt") AS day, c."canonicalUrl",
              COALESCE(s.name, c.publisher, c."sourceId") AS publisher
       FROM civic_items c LEFT JOIN sources s ON s.id = c."sourceId"
       WHERE c."localitySlug" = $1 AND COALESCE(c."eventDate", c."publishedAt") >= $2
       ORDER BY day ASC, c.id ASC LIMIT $3`,
      [localitySlug, day, limit]
    )) as {
      id: number;
      kind: string;
      title: string;
      body: string | null;
      day: string | null;
      canonicalUrl: string | null;
      publisher: string;
    }[];
    return rows.map((row) => ({
      kind: row.kind === 'news' ? 'news' : 'record',
      ref: `civic:${row.id}`,
      title: row.title,
      excerpt: (row.body ?? '').slice(0, RECORD_EXCERPT),
      date: row.day?.slice(0, 10) ?? null,
      url: row.canonicalUrl,
      publisher: row.publisher,
    }));
  }
}
