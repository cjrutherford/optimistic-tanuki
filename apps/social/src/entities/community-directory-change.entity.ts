import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Durable notification, intentionally independent of the deleted community row. */
@Entity({ name: 'community_directory_change' })
export class CommunityDirectoryChange {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) revision!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 16 }) operation!: 'changed' | 'deleted';
  @Column({ type: 'uuid', nullable: true }) sourceEpoch!: string | null;
  @Generated('uuid')
  @Column({ type: 'uuid', unique: true })
  eventNonce!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
