import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';

export enum CommunityMembershipStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

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
    type: 'varchar',
    default: 'pending',
  })
  status: CommunityMembershipStatus;

  @CreateDateColumn()
  createdAt: Date;
}
