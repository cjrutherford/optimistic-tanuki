import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KeyDatum as KeyDataEntity } from '../../key-data/entities';
import { TokenEntity } from '../../tokens/entities';
import { OAuthProviderEntity } from '../../oauth-providers/entities/oauth-provider.entity';
import { AuthActionTokenEntity } from '../../email-auth/entities/auth-action-token.entity';
import { v4 as uuidv4 } from 'uuid';
import { IsObject } from 'class-validator';

@Entity()
export class UserEntity {
  constructor() {
    this.id = uuidv4();
  }
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  password: string;

  @Column({ type: 'text' })
  bio: string;

  @Column({ default: null })
  totpSecret?: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  emailVerifiedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginCount?: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lockedUntil?: Date | null;

  @OneToMany((type) => TokenEntity, (te) => te.user)
  tokens: TokenEntity[];

  @OneToOne(() => KeyDataEntity, (kde) => kde.id)
  @JoinColumn()
  @IsObject()
  keyData: KeyDataEntity;

  @OneToMany(() => OAuthProviderEntity, (op) => op.user)
  oauthProviders: OAuthProviderEntity[];

  @OneToMany(() => AuthActionTokenEntity, (token) => token.user)
  authActionTokens: AuthActionTokenEntity[];
}
