import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { IsObject, IsString } from 'class-validator';

@Entity()
export class KeyDatum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bytea' })
  public: Buffer;

  @Column()
  @IsString()
  salt: string;

  @OneToOne(() => UserEntity, (ue) => ue.id)
  @JoinColumn()
  User: UserEntity;
}
