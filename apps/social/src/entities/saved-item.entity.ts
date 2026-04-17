import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity()
@Unique(['profileId', 'itemType', 'itemId'])
export class SavedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column({
    type: 'enum',
    enum: ['post', 'comment'],
  })
  itemType: 'post' | 'comment';

  @Column()
  itemId: string;

  @Column({ nullable: true })
  itemTitle: string;

  @CreateDateColumn()
  savedAt: Date;
}
