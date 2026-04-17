import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity()
@Unique(['muterId', 'mutedId'])
export class UserMute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  muterId: string;

  @Column()
  mutedId: string;

  @Column({ nullable: true })
  duration: number; // in seconds, null for indefinite

  @CreateDateColumn()
  createdAt: Date;
}
