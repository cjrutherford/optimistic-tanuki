/* istanbul ignore file */
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Comment } from './comment.entity';
import { Post } from './post.entity';

@Entity()
export class Vote {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    value: number;

    @Column()
    userId: string; // Changed from relation to user ID string

    @Column()
    profileId: string;

    @ManyToOne(() => Post, post => post.votes)
    post?: Post;

    @ManyToOne(() => Comment, comment => comment.votes)
    comment?: Comment;

}
