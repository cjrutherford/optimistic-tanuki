import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A person a town's agendas name as an official (mayor, council member,
 * commissioner...). Read from public agenda text, so it is not tenant-isolated
 * like the agendas themselves: civic-briefing reads officials across towns.
 */
@Entity('civic_officials')
@Index('UQ_civic_officials_tenant_name', ['tenantId', 'normalizedName'], {
  unique: true,
})
export class CivicOfficial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** The name as compared: case, accents, punctuation and Jr./Sr. aside. */
  @Column({ type: 'varchar', length: 255 })
  normalizedName: string;

  @Column({ type: 'varchar', length: 128 })
  role: string;

  /** The agenda that last named this person. */
  @Column({ type: 'uuid', nullable: true })
  sourceAgendaId: string | null;

  @Column({ type: 'timestamp' })
  firstSeen: Date;

  @Column({ type: 'timestamp' })
  lastSeen: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
