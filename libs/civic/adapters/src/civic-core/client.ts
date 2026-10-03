/**
 * What the civic-core adapter needs from Civic Core (`apps/civic`). These
 * mirror the records that service returns over TCP, and nothing else: the
 * adapter stays independent of that app's code, and the service supplies the
 * transport.
 */

export type CivicTenantKind = 'city' | 'town' | 'village' | 'county';

export interface CivicTenantRecord {
  id: string;
  displayName: string;
  townName: string;
  /** Two-letter state code. */
  state: string;
  kind: CivicTenantKind;
}

export interface CivicAgendaItemRecord {
  id: string;
  itemNumber?: string;
  title: string;
  summary: string;
  pageRef?: number;
}

export interface CivicAgendaRecord {
  id: string;
  meetingBody: string;
  /** ISO date or timestamp of the meeting. */
  meetingDate: string;
  title: string;
  items: CivicAgendaItemRecord[];
}

export interface CivicBroadcastRecord {
  id: string;
  severity: string;
  headline: string;
  body: string;
  issuedAt: string;
  expiresAt?: string;
  audience?: string;
}

export interface CivicTipProjectRecord {
  id: string;
  name: string;
  description: string;
  fundingAllocatedCents: number;
  fundingSpentCents: number;
  status: string;
  milestone?: string;
}

/** Port to Civic Core. Reads only: civic-briefing never writes to it. */
export interface CivicCoreClient {
  tenants(): Promise<CivicTenantRecord[]>;
  agendas(
    tenantId: string,
    opts?: { limit?: number }
  ): Promise<CivicAgendaRecord[]>;
  broadcasts(
    tenantId: string,
    opts?: { since?: string; limit?: number }
  ): Promise<CivicBroadcastRecord[]>;
  tipProjects(tenantId: string): Promise<CivicTipProjectRecord[]>;
}
