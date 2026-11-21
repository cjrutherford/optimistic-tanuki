import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CommunityElection } from './community-election.entity';

@Entity()
export class ElectionCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_candidate_electionId')
  @Column({ type: 'uuid' })
  electionId: string;

  @ManyToOne(() => CommunityElection, (election) => election.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'electionId',
    foreignKeyConstraintName: 'election_candidate_electionId_fkey',
  })
  election: CommunityElection;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  profileId: string;

  @Column({ default: 0 })
  voteCount: number;

  @Column({ default: false })
  isWithdrawn: boolean;

  @CreateDateColumn()
  nominatedAt: Date;
}
