import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { IsObject, IsString } from 'class-validator';

/**
 * Represents a key datum entity in the database.
 */
@Entity()
export class KeyDatum {
  /**
   * The unique identifier of the key datum.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The public key as a Buffer.
   */
  @Column({ type: 'bytea' })
  public: Buffer;

  /**
   * The salt used for key generation.
   */
  @Column()
  @IsString()
  salt: string;

  /**
   * The associated user entity.
   */
  @OneToOne(() => UserEntity, (ue) => ue.id)
  @JoinColumn()
  User: UserEntity;
}
