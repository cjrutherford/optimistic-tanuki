import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

@Entity({ name: 'oauth_provider' })
export class OAuthProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string;

  @Column()
  providerUserId: string;

  @Column({ nullable: true })
  providerEmail?: string;

  @Column({ nullable: true })
  providerDisplayName?: string;

  // Note: OAuth tokens should be encrypted at rest in production environments.
  // Consider using application-level encryption before persisting these values.
  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.oauthProviders)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
