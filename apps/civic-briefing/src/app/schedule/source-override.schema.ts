import { EntitySchema } from 'typeorm';

/**
 * An operator's standing decision about one source (SD.6): `block` means
 * discovery never adopts it, `pin` means discovery adopts it even where it
 * refused. One active row per source key; clearing keeps the row, so who
 * blocked what and why stays on record.
 */
export type SourceOverrideKind = 'block' | 'pin';

export interface SourceOverrideRow {
  id: string;
  /** The town the operator was looking at; the override itself is by source key. */
  slug: string;
  sourceKey: string;
  kind: SourceOverrideKind;
  reason: string;
  /** The operator's account id. */
  actor: string;
  createdAt?: Date;
  clearedAt?: Date | null;
  clearedBy?: string | null;
  clearReason?: string | null;
}

export const SourceOverrideSchema = new EntitySchema<SourceOverrideRow>({
  name: 'SourceOverride',
  tableName: 'source_overrides',
  columns: {
    id: { type: 'uuid', primary: true },
    slug: { type: String },
    sourceKey: { type: String },
    kind: { type: String },
    reason: { type: 'text' },
    actor: { type: String },
    createdAt: { type: 'timestamptz', createDate: true },
    clearedAt: { type: 'timestamptz', nullable: true },
    clearedBy: { type: String, nullable: true },
    clearReason: { type: 'text', nullable: true },
  },
  indices: [{ columns: ['sourceKey'] }, { columns: ['slug'] }],
});
