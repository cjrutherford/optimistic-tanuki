import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DiscInterviewTurn,
  UserOnboardingProfile,
} from './user-onboarding-profile.interface';

@Entity('lead_onboarding_profiles')
export class LeadOnboardingProfileRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true })
  profileId: string | null;

  @Column({ type: 'varchar', default: 'leads-app' })
  appScope: string;

  @Column({ type: 'jsonb' })
  profile: UserOnboardingProfile;

  /**
   * The DISC interview as it was actually conducted. Persisted so a re-run can
   * be told what this person was already asked, instead of putting the same
   * questions to them a second time.
   */
  // Plain string default rather than `() => "'[]'::jsonb"`: TypeORM compares a
  // function default against the database's rendering and never matches, so the
  // generator proposed a no-op ALTER on every run.
  @Column({ type: 'jsonb', default: '[]' })
  discTranscript: DiscInterviewTurn[];

  @Column({ type: 'int', default: 0 })
  currentStep: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
