import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { KeyDatum as KeyDataEntity } from "../../key-data/entities/key-datum.entity";
import { TokenEntity } from "../../tokens/entities/token.entity";
import { v4 as uuidv4 } from 'uuid';
import { IsObject } from "class-validator";

/**
 * Represents a user entity in the database.
 */
@Entity()
export class UserEntity {
    /**
     * Creates an instance of UserEntity and generates a UUID for the ID.
     */
    constructor() { this.id = uuidv4()}
  /**
   * The unique identifier of the user.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The email address of the user.
   */
  @Column()
  email: string;

  /**
   * The first name of the user.
   */
  @Column()
  firstName: string;

  /**
   * The last name of the user.
   */
  @Column()
  lastName: string;

  /**
   * The hashed password of the user.
   */
  @Column()
  password: string;

  /**
   * The biography of the user.
   */
  @Column({ type: 'text' })
  bio: string;
  
  /**
   * The TOTP secret for multi-factor authentication (optional).
   */
  @Column({ default: null })
  totpSecret?: string;

  /**
   * The tokens associated with the user.
   */
  @OneToMany((type) => TokenEntity, (te) => te.user)
  tokens: TokenEntity[];

  /**
   * The key data associated with the user.
   */
  @OneToOne(() => KeyDataEntity, (kde) => kde.id)
  @JoinColumn()
  @IsObject()
  keyData: KeyDataEntity;
}
