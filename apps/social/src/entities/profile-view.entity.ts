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

  @Column({ type: 'varchar', nullable: true })
  profileId: string | null;

  @Column({ type: 'varchar', nullable: true })
  viewerId: string | null;

  @Column()
  source: string;

  @CreateDateColumn()
  viewedAt: Date;
}
