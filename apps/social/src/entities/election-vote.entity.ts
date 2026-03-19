import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CommunityElection } from './community-election.entity';

@Entity()
@Unique(['electionId', 'voterId'])
export class ElectionVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  electionId: string;

  @ManyToOne(() => CommunityElection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'electionId' })
  election: CommunityElection;

  @Column({ type: 'uuid' })
  voterId: string;

  @Column({ type: 'uuid' })
  voterProfileId: string;

  @Column({ type: 'uuid' })
  candidateId: string;

  @Column({ type: 'uuid' })
  candidateUserId: string;

  @CreateDateColumn()
  votedAt: Date;
}
