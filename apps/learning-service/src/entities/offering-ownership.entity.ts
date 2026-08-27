import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Ownership of an authored offering.
 *
 * An offering is not a row, it is a value nested inside a ProgramTrack's
 * JSONB `data` column, so there is nowhere to hang a foreign key for "who
 * owns it". This side table answers that question instead, keyed on the
 * offering's own id, which is stable and unique across the catalog.
 */
@Entity('lp_offering_ownership')
export class OfferingOwnershipEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  offeringId!: string;

  @Column({ type: 'uuid' })
  ownerProfileId!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  coEditorProfileIds!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
