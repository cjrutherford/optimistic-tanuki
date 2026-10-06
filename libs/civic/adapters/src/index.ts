import {
  registerAdapter,
  type SourceAdapter,
} from '@optimistic-tanuki/civic-core';
import { rssAdapter } from './rss/index.js';
import { httpScrapeAdapter } from './http-scrape/index.js';
import { openDataAdapter } from './open-data/index.js';
import { documentAdapter } from './document/index.js';
import { newsDiscoverAdapter } from './news-discover/index.js';
import { apptegyAdapter } from './apptegy/index.js';
import { legistarAdapter } from './legistar/index.js';
import { granicusAdapter } from './granicus/index.js';
import { civicClerkAdapter } from './civicclerk/index.js';

/**
 * Every protocol adapter a locality may name.
 *
 * A locality names its adapter by string, so an unregistered adapter is not a
 * type error — it is a run where that source fails and its town quietly loses
 * a record. Keeping one list means the command line, the pipeline service and
 * the tests cannot drift apart, which is exactly how the Berrien school board
 * disappeared from one implementation and not the other.
 */
export const ALL_ADAPTERS: readonly SourceAdapter[] = [
  rssAdapter,
  httpScrapeAdapter,
  openDataAdapter,
  documentAdapter,
  newsDiscoverAdapter,
  apptegyAdapter,
  legistarAdapter,
  granicusAdapter,
  civicClerkAdapter,
];

/** Registers every adapter. Safe to call more than once. */
export function registerAllAdapters(): void {
  for (const adapter of ALL_ADAPTERS) registerAdapter(adapter);
}

// The email adapter is not in ALL_ADAPTERS: it needs a mailbox at construction.
// The service registers it with its configured inbox, e.g.
// registerAdapter(createEmailAdapter(new ImapMailbox({ url })));
export {
  createEmailAdapter,
  parseEmailConfig,
  stripEmailFooter,
} from './email/index.js';
export type { EmailSourceConfig } from './email/index.js';
export { ImapMailbox } from './email/imap-mailbox.js';
export type { ImapMailboxOptions } from './email/imap-mailbox.js';
export { senderMatches } from './email/mailbox.js';
export type { MailMessage, Mailbox } from './email/mailbox.js';

// The civic-core adapter is not in ALL_ADAPTERS either: it reads over TCP
// through a client the service supplies, e.g.
// registerAdapter(createCivicCoreAdapter(new TcpCivicCoreClient(proxy)));
export {
  createCivicCoreAdapter,
  parseCivicCoreConfig,
} from './civic-core/index.js';
export type {
  CivicAgendaItemRecord,
  CivicAgendaRecord,
  CivicBroadcastRecord,
  CivicCoreClient,
  CivicCoreSourceConfig,
  CivicTenantKind,
  CivicTenantRecord,
  CivicTipProjectRecord,
} from './civic-core/index.js';
export { matchTenants } from './civic-core/match.js';
export type { TenantMatch } from './civic-core/match.js';
