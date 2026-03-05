import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum MessageType {
  CHAT = 'chat',
  INFO = 'info',
  WARNING = 'warning',
  SYSTEM = 'system',
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  senderId: string;

  @Column('text')
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  reactions: MessageReaction[];

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @Column('simple-array', { nullable: true })
  readBy: string[];

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.CHAT,
  })
  type: MessageType;

  @CreateDateColumn()
  createdAt: Date;
}
