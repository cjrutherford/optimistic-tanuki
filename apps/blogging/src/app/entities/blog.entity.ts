import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Post } from "./post.entity";
import { Contact } from "./contact.entity";
import { Event } from "./event.entity";

@Entity()
export class Blog {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @Column()
    name: string;

    @Column()
    description: string;

    @Column()
    ownerId: string;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @OneToMany(() => Post, post => post.blog)
    posts: Post[];

    @OneToMany(() => Contact, contact => contact.blog)
    contacts: Contact[];

    @OneToMany(() => Event, event => event.blog)
    events: Event[];
}