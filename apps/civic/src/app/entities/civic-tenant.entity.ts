import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * A municipality operating Civic Core. Its town name and state let
 * civic-briefing match it to a briefing locality (ADR
 * docs/architecture/civic-briefing-and-civic-core.md).
 */
@Entity('civic_tenants')
export class CivicTenant {
  /** The tenantId the tenant's agendas, TIP projects and broadcasts carry. */
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  /** The place's name as residents know it ("Tifton", "Escambia County"). */
  @Column({ type: 'varchar', length: 255 })
  townName: string;

  /** Two-letter US state code. */
  @Column({ type: 'varchar', length: 2 })
  state: string;

  /** What kind of government it is: city, town, village or county. */
  @Column({ type: 'varchar', length: 32 })
  kind: string;

  @CreateDateColumn()
  createdAt: Date;
}
