import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('civic_agendas')
@Index('IDX_civic_agendas_tenant_body', ['tenantId', 'meetingBody'])
export class CivicAgenda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  meetingBody: string;

  @Column({ type: 'timestamp' })
  meetingDate: Date;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceFileName: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
