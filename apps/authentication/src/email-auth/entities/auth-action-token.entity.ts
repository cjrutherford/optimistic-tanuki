import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

export enum AuthActionPurpose {
  Verification = 'verification',
  PasswordReset = 'password-reset',
  MagicLink = 'magic-link',
}

@Entity({ name: 'auth_action_token' })
export class AuthActionTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash!: string;

  @Column({ type: 'enum', enum: AuthActionPurpose })
  purpose!: AuthActionPurpose;

  @Column()
  appId!: string;

  @Column({ default: '/' })
  returnPath!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  consumedAt: Date | null = null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.authActionTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;
}
