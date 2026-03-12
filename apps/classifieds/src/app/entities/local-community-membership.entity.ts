import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { LocalCommunityEntity } from './local-community.entity';

@Entity('local_community_membership')
@Unique(['communityId', 'userId'])
export class LocalCommunityMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  communityId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => LocalCommunityEntity, (c) => c.memberships, {
    onDelete: 'CASCADE',
  })
  community!: LocalCommunityEntity;

  @CreateDateColumn()
  joinedAt!: Date;
}
