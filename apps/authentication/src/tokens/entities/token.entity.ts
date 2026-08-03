import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

@Entity({ name: 'token' })
export class TokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  tokenData: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne((type) => UserEntity, (ue) => ue.tokens, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: UserEntity | null;

  @Column({ type: 'boolean', default: false })
  revoked = false;

  @Column({ type: 'uuid', nullable: true })
  profileId?: string | null;
}
