import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Message } from "./message.entity";

@Entity()
export default class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column("text", { array: true })
    participants: string[]; // Array of participant IDs matching profile ids.

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];
}
