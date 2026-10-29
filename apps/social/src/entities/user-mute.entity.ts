import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['muterId', 'mutedId'], {
  unique: true,
  where: '"mutedId" <> \'00000000-0000-0000-0000-000000000000\'',
})
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
