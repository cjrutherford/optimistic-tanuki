import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['profileId', 'viewedAt'])
export class ProfileView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column()
  viewerId: string;

  @Column()
  source: string;

  @CreateDateColumn()
  viewedAt: Date;
}
