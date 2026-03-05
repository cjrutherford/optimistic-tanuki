import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActivityType {
  POST = 'post',
  COMMENT = 'comment',
  LIKE = 'like',
  SHARE = 'share',
  FOLLOW = 'follow',
  MENTION = 'mention',
}

@Entity()
@Index(['profileId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column()
  description: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ nullable: true })
  resourceType: string;

  @CreateDateColumn()
  createdAt: Date;
}
