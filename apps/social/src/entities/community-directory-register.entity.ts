import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Current private reconciliation intent; tombstones deliberately have no community FK. */
@Entity({ name: 'community_directory_register' })
export class CommunityDirectoryRegister {
  @PrimaryColumn('uuid') communityId!: string;
  @Column('uuid') changeToken!: string;
  @Column({ type: 'varchar', length: 16 }) operation!: 'changed' | 'deleted';
  @Column({ type: 'boolean', default: true }) dirty!: boolean;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
