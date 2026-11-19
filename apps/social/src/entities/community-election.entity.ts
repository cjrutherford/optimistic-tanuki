import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ElectionCandidate } from './election-candidate.entity';

export type ElectionStatus = 'pending' | 'open' | 'closed' | 'cancelled';

@Entity()
export class CommunityElection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_election_communityId')
  @Column({ type: 'uuid' })
  communityId: string;

  @Index('idx_election_status')
  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: ElectionStatus;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  winnerProfileId: string | null;

  @Column({ nullable: true })
  initiatedBy: string;

  @OneToMany(() => ElectionCandidate, (candidate) => candidate.election)
  candidates: ElectionCandidate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
