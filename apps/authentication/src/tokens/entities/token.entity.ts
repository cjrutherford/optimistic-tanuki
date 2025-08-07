import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";

/**
 * Represents a token entity in the database.
 */
@Entity({name: 'token'})
export class TokenEntity {
  /**
   * The unique identifier of the token.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The token data.
   */
  @Column({type: 'text'})
  tokenData: string;

  /**
   * The ID of the user associated with the token.
   */
  @JoinColumn()
  userId: string;

  /**
   * The user entity associated with the token.
   */
  @ManyToOne(type => UserEntity, ue => ue.tokens)
  user: UserEntity;

  /**
   * Indicates whether the token is revoked.
   */
  @Column({type: 'boolean', default: false })
  revoked = false;
}