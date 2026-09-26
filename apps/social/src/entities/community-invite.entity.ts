import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CommunityMembershipStatus } from './community-member.entity';

// this is pending removal as it was a duplicate from the community-member.entity.ts file
// export enum CommunityMembershipStatus {
//   PENDING = 'pending',
//   APPROVED = 'approved',
//   REJECTED = 'rejected',
// }

@Entity()
@Unique(['communityId', 'inviteeId'])
export class CommunityInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  communityId: string;

  @Column()
  inviterId: string;

  // Null for email invites to people without a known account; bound to the
  // claiming user on accept.
  @Column({ nullable: true })
  inviteeId: string | null;

  // Normalized (lower-cased) email the invitation was addressed to.
  @Column({ nullable: true })
  inviteeEmail: string | null;

  // Unguessable single-use claim token for email invitations. Returned only
  // on creation (so the gateway can build the invitation link) and never
  // exposed by read paths.
  @Column({ nullable: true, unique: true })
  token: string | null;

  @Column({
    type: 'enum',
    enum: CommunityMembershipStatus,
    default: CommunityMembershipStatus.PENDING,
  })
  status: CommunityMembershipStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
