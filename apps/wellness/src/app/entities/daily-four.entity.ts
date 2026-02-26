import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class DailyFourEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  affirmation!: string;

  @Column({ type: 'text' })
  mindfulActivity!: string;

  @Column({ type: 'text' })
  gratitude!: string;

  @Column({ type: 'text' })
  plannedPleasurable!: string;

  @Column({ default: false })
  public!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @Column('uuid')
  profileId!: string;
}
