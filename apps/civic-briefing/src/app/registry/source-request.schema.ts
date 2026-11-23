import { EntitySchema } from 'typeorm';

/**
 * A signed-in reader's ask for sources for a town that has none (D32). One row
 * per reader per town, so operators can see demand without a reader inflating
 * it by asking twice.
 */
export interface SourceRequestRow {
  id: string;
  /** The town the reader asked for. */
  slug: string;
  userId: string;
  note?: string | null;
  /** An operator's decision on the request (SD.6). */
  status?: 'pending' | 'approved' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: Date | null;
  decisionReason?: string | null;
  createdAt?: Date;
}

export const SourceRequestSchema = new EntitySchema<SourceRequestRow>({
  name: 'SourceRequest',
  tableName: 'source_requests',
  columns: {
    id: { type: 'uuid', primary: true },
    slug: { type: String },
    userId: { type: String },
    note: { type: 'text', nullable: true },
    status: { type: String, default: 'pending' },
    decidedBy: { type: String, nullable: true },
    decidedAt: { type: 'timestamptz', nullable: true },
    decisionReason: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
  },
  indices: [{ columns: ['slug'] }],
  uniques: [{ columns: ['slug', 'userId'] }],
});
