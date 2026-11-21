import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  ForeignKey,
} from 'typeorm';
import { CommunityElection } from './community-election.entity';
import { ElectionCandidate } from './election-candidate.entity';

@Entity()
@ForeignKey(() => ElectionCandidate, ['candidateId'], ['id'], {
  name: 'election_vote_candidateId_fkey',
  onDelete: 'CASCADE',
})
@Unique('election_vote_electionId_voterId_key', ['electionId', 'voterId'])
export class ElectionVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_vote_electionId')
  @Column({ type: 'uuid' })
  electionId: string;

  @ManyToOne(() => CommunityElection, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'electionId',
    foreignKeyConstraintName: 'election_vote_electionId_fkey',
  })
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
