import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { KeyDatum as KeyDataEntity } from "../../key-data/entities/key-datum.entity";
import { TokenEntity } from "../../tokens/entities/token.entity";
import { v4 as uuidv4 } from 'uuid';
import { IsObject } from "class-validator";

@Entity()
export class UserEntity {
    constructor() { this.id = uuidv4()}
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

  @OneToMany((type) => TokenEntity, (te) => te.user)
  tokens: TokenEntity[];

  @OneToOne(() => KeyDataEntity, (kde) => kde.id)
  @JoinColumn()
  @IsObject()
  keyData: KeyDataEntity;
}
