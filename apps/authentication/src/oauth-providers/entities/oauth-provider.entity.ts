import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

@Entity({ name: 'oauth_provider' })
@Index('IDX_oauth_provider_userId', ['userId'])
@Index('UQ_oauth_provider_identity', ['provider', 'providerUserId'], {
  unique: true,
})
@Index('UQ_oauth_provider_user_provider', ['provider', 'userId'], {
  unique: true,
})
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

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.oauthProviders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_oauth_provider_userId',
  })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
