import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SearchType = 'all' | 'users' | 'posts' | 'communities';

@Entity()
@Index(['profileId', 'query'])
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column()
  query: string;

  @Column({
    type: 'enum',
    enum: ['all', 'users', 'posts', 'communities'],
    default: 'all',
  })
  searchType: SearchType;

  @Column({ default: 0 })
  resultCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
