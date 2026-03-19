import {
  Column,
  Entity,
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

  @Column({ type: 'uuid' })
  electionId: string;

  @ManyToOne(() => CommunityElection, (election) => election.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'electionId' })
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
