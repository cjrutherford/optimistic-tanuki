import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import Conversation from './conversation.entity';

/**
 * Defines the types of messages.
 */
export enum MessageType {
    /**
     * A standard chat message.
     */
    CHAT = 'chat',
    /**
     * An informational message.
     */
    INFO = 'info',
    /**
     * A warning message.
     */
    WARNING = 'warning',
    /**
     * A system message.
     */
    SYSTEM = 'system',
}

/**
 * Represents a message entity in the database.
 */
@Entity()
export class Message {
    /**
     * The unique identifier of the message.
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * The content of the message.
     */
    @Column()
    content: string;

    /**
     * The ID of the sender.
     */
    @Column()
    senderId: string;

    /**
     * The type of the message.
     */
    @Column({ type: 'enum', enum: MessageType, default: MessageType.CHAT })
    type: MessageType;

    /**
     * An array of recipient IDs matching profile IDs.
     */
    @Column('text', { array: true })
    recipients: string[];

    /**
     * The conversation this message belongs to.
     */
    @ManyToOne(type => Conversation, conversation => conversation.messages, { onDelete: 'CASCADE' })
    conversation: Conversation;

    /**
     * The timestamp when the message was created.
     */
    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt: Date;

    /**
     * The timestamp when the message was last updated.
     */
    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt: Date;
}