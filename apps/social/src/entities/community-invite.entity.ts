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

  @Column()
  inviteeId: string;

  @Column({
    type: 'enum',
    enum: CommunityMembershipStatus,
    default: CommunityMembershipStatus.PENDING,
  })
  status: CommunityMembershipStatus;

  @CreateDateColumn()
  createdAt: Date;
}
