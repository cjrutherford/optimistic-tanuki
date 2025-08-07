import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Message } from "./message.entity";

/**
 * Represents a chat conversation entity in the database.
 */
@Entity()
export default class Conversation {
    /**
     * The unique identifier of the conversation.
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * The title of the conversation.
     */
    @Column()
    title: string;

    /**
     * The timestamp when the conversation was created.
     */
    @Column()
    createdAt: Date;

    /**
     * The timestamp when the conversation was last updated.
     */
    @Column()
    updatedAt: Date;

    /**
     * An array of participant IDs matching profile IDs.
     */
    @Column("text", { array: true })
    participants: string[];

    /**
     * The messages belonging to this conversation.
     */
    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];
}
