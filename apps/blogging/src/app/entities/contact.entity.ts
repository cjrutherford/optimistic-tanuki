import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Blog } from "./blog.entity";

@Entity()
export class Contact {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    message: string; // this will be HTML text-only content.

    @Column()
    email: string;

    @Column({ nullable: true, default: null })
    phone?: string;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @Column({ default: false })
    addressed: boolean;

    @ManyToOne(() => Blog, blog => blog.contacts)
    blog: Blog;
}