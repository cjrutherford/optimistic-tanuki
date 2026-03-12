import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommunityMember } from './community-member.entity';

export type LocalityType =
  | 'city'
  | 'town'
  | 'neighborhood'
  | 'county'
  | 'region';

@Entity()
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  /** URL-safe slug; set only for locality-based communities. */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  slug: string | null;

  /** When set, this community represents a real-world locality. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  localityType: LocalityType | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  adminArea: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lng: number | null;

  @Column({ type: 'integer', nullable: true })
  population: number | null;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column()
  ownerId: string;

  @Column()
  ownerProfileId: string;

  @Column({ type: 'varchar', default: 'social' })
  appScope: string;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({
    type: 'varchar',
    default: 'public',
  })
  joinPolicy: 'public' | 'approval_required' | 'invite_only';

  @Column({ type: 'jsonb', default: [] })
  tags: { id: string; name: string }[];

  @OneToMany(() => CommunityMember, (member) => member.community)
  members: CommunityMember[];

  @Column({ default: 0 })
  memberCount: number;

  @Column({ nullable: true })
  bannerAssetId: string;

  @Column({ nullable: true })
  logoAssetId: string;

  @Column({ nullable: true })
  chatRoomId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
