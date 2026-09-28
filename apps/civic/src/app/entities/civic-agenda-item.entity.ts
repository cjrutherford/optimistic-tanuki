import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('civic_agenda_items')
@Index('IDX_civic_agenda_items_agenda', ['agendaId'])
export class CivicAgendaItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'uuid' })
  agendaId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  itemNumber: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'int', nullable: true })
  pageRef: number | null;
}
