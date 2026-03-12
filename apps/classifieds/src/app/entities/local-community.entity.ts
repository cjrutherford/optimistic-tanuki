import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LocalCommunityMembershipEntity } from './local-community-membership.entity';

export type LocalityType = 'city' | 'town' | 'neighborhood' | 'county' | 'region';

@Entity('local_community')
export class LocalCommunityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 50, default: 'city' })
  localityType!: LocalityType;

  @Column({ type: 'varchar', length: 3, default: 'US' })
  countryCode!: string;

  @Column({ type: 'varchar', length: 100 })
  adminArea!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lat!: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lng!: number | null;

  @Column({ type: 'integer', default: 0 })
  population!: number;

  @Column({ type: 'integer', default: 0 })
  memberCount!: number;

  @OneToMany(() => LocalCommunityMembershipEntity, (m) => m.community)
  memberships!: LocalCommunityMembershipEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
