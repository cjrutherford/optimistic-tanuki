/* istanbul ignore file */
import { Column, Entity, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Post } from './post.entity';

@Entity()
export class Link {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    url: string;

    @ManyToMany(() => Post, post => post.links)
    posts: Post[];
}
