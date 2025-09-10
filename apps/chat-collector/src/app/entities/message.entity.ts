import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import Conversation from './conversation.entity';

export enum MessageType {
    CHAT = 'chat',
    INFO = 'info',
    WARNING = 'warning',
    SYSTEM = 'system',
}

@Entity()
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    content: string;

    @Column()
    senderId: string;

    @Column({ type: 'enum', enum: MessageType, default: MessageType.CHAT })
    type: MessageType;

    @Column('text', { array: true })
    recipients: string[]; // Array of recipient IDs matching profile ids.

    @ManyToOne(type => Conversation, conversation => conversation.messages, { onDelete: 'CASCADE' })
    conversation: Conversation;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt: Date;
}