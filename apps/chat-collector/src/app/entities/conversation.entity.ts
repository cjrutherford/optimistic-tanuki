import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Message } from './message.entity';

export enum ConversationType {
  DIRECT = 'direct',
  COMMUNITY = 'community',
}

@Entity()
export default class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type: ConversationType;

  @Column({ nullable: true })
  communityId: string;

  @Column({ nullable: true })
  ownerId: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column('text', { array: true })
  participants: string[]; // Array of participant IDs matching profile ids.

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
