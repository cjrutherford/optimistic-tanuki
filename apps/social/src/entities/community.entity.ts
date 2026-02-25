import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommunityMember } from './community-member.entity';

@Entity()
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

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
