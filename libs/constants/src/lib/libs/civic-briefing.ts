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
  /** Every town with a published briefing. */
  EDITIONS: 'civic-briefing.editions.list',
  /** A town's recent editions, newest first. */
  EDITION_HISTORY: 'civic-briefing.editions.history',
  /** One published briefing: a town's newest, or the one for a date. */
  BRIEFING: 'civic-briefing.editions.briefing',
} as const;
