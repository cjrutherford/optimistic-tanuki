import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";

@Entity({name: 'token'})
export class TokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({type: 'text'})
  tokenData: string;

  @JoinColumn()
  userId: string;

  @ManyToOne(type => UserEntity, ue => ue.tokens)
  user: UserEntity;

  @Column({type: 'boolean', default: false })
  revoked = false;
}