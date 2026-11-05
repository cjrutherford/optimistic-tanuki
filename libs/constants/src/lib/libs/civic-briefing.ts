/**
 * TCP message patterns served by civic-briefing: read-only views of the
 * foundation database for civic-contributions, which owns no copy of it.
 */
export const CivicBriefingCommands = {
  /** Published news articles, for the copying index. */
  CORPUS_NEWS: 'civic-briefing.corpus.news',
  /** Recent meetings and current stories in a town, for a report to attach to. */
  SUBJECTS: 'civic-briefing.corpus.subjects',
  /** The desk (topic) a meeting or story belongs to. */
  TOPIC_FOR: 'civic-briefing.corpus.topic-for',
  /** What a town's sources published on or after a day. */
  RECORDS_SINCE: 'civic-briefing.corpus.records-since',
  /** Each town's latest run and its failing or quiet sources (P5.2). */
  PIPELINE_HEALTH: 'civic-briefing.health.pipeline',
  /** Pull towns' sources, then backfill their editions (D31). */
  BACKFILL_START: 'civic-briefing.operations.backfill.start',
  /** The latest backfill's progress. */
  BACKFILL_STATUS: 'civic-briefing.operations.backfill.status',
  /** Every town with a published briefing. */
  EDITIONS: 'civic-briefing.editions.list',
  /** A town's recent editions, newest first. */
  EDITION_HISTORY: 'civic-briefing.editions.history',
  /** One published briefing: a town's newest, or the one for a date. */
  BRIEFING: 'civic-briefing.editions.briefing',
  /** Every locality in the registry, with its sources and officials, for civic-contributions. */
  LIST_LOCALITIES: 'civic-briefing.localities.list',
  /** Whether a town has sources, and how many readers asked for them (D32). */
  SOURCE_STATUS: 'civic-briefing.localities.source-status',
  /** A signed-in reader asks for sources for a town; one request per reader per town (D32). */
  REQUEST_SOURCES: 'civic-briefing.localities.request-sources',
  /** Names Civic Core read from agendas, awaiting an operator's decision (D33); `{ slug?, status? }`, pending by default. */
  OFFICIAL_CANDIDATES: 'civic-briefing.officials.candidates',
  /** Accept a candidate into the town's officials roster with a source the operator supplies (D33). */
  ACCEPT_OFFICIAL_CANDIDATE: 'civic-briefing.officials.accept',
  /** Reject a candidate; it is not suggested again (D33). */
  REJECT_OFFICIAL_CANDIDATE: 'civic-briefing.officials.reject',
} as const;
