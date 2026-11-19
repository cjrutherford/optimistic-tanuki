import { EntitySchema } from 'typeorm';

export type OfficialCandidateStatus = 'pending' | 'accepted' | 'rejected';

/**
 * A name Civic Core read from a town's agendas (D33). It reaches the town's
 * `officials.roster` only once an operator accepts it with a source.
 */
export interface OfficialCandidateRow {
  /** Set by the application, not the database. */
  id: string;
  /** The locality the Civic Core tenant matched. */
  slug: string;
  name: string;
  /** The name collapsed for comparison; (slug, normalizedName) is unique. */
  normalizedName: string;
  role: string;
  civicTenantId: string;
  sourceAgendaId?: string | null;
  firstSeen: Date;
  lastSeen: Date;
  status: OfficialCandidateStatus;
  decidedBy?: string | null;
  decidedAt?: Date | null;
}

export const OfficialCandidateSchema = new EntitySchema<OfficialCandidateRow>({
  name: 'OfficialCandidate',
  tableName: 'official_candidates',
  columns: {
    id: { type: 'uuid', primary: true },
    slug: { type: String },
    name: { type: String },
    normalizedName: { type: String },
    role: { type: String },
    civicTenantId: { type: String },
    sourceAgendaId: { type: String, nullable: true },
    firstSeen: { type: 'timestamptz' },
    lastSeen: { type: 'timestamptz' },
    status: { type: String, default: 'pending' },
    decidedBy: { type: String, nullable: true },
    decidedAt: { type: 'timestamptz', nullable: true },
  },
  indices: [{ columns: ['slug', 'status'] }],
  uniques: [{ columns: ['slug', 'normalizedName'] }],
});
