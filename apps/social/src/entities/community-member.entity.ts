import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Community } from './community.entity';

export enum CommunityMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export enum CommunityMembershipStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
}

@Entity()
@Unique(['communityId', 'userId'])
export class CommunityMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  communityId: string;

  @ManyToOne(() => Community, (community) => community.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'communityId' })
  community: Community;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({
    type: 'varchar',
    default: 'member',
  })
  role: CommunityMemberRole;

  @Column({
    type: 'enum',
    enum: CommunityMembershipStatus,
    default: CommunityMembershipStatus.APPROVED,
  })
  status: CommunityMembershipStatus;

  @CreateDateColumn()
  joinedAt: Date;
}
