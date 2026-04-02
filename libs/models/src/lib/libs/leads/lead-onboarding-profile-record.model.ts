import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserOnboardingProfile } from './user-onboarding-profile.interface';

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

  @Column({ type: 'int', default: 0 })
  currentStep: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
