import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Like } from 'typeorm';
import { Post } from './post.entity';
import { Vote } from './vote.entity';
import { FindManyOptions } from 'typeorm';
import { SearchCommentDto } from '@optimistic-tanuki/models';
import { FindOptionsWhere } from 'typeorm';

@Entity()
export class Comment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    content: string;

    @Column()
    userId: string; // Changed from relation to user ID string

    @Column()
    profileId: string;

    @ManyToOne(() => Post, post => post.comments)
    post: Post;

    @OneToMany( type => Comment, comment => comment.parent)
    replies: Comment[];

    @ManyToOne( type => Comment, comment => comment.replies)
    parent: Comment;

    @OneToMany(() => Vote, vote => vote.comment)
    votes: Vote[];
    
    
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}

export function transformSearchCommentDtoToFindOptions(dto: SearchCommentDto): FindManyOptions<Comment> {
    const findOptions: FindManyOptions<Comment> = {
        where: {} as FindOptionsWhere<Comment>,
        relations: [],
    };
    const tempRelations: string[] = []; 

    if (dto.content) {
        findOptions.where['content'] = dto.content;
    }

    if (dto.userId) {
        findOptions.where['userId'] = dto.userId;
    }

    if (dto.postId) {
        findOptions.where['post'] = { id: dto.postId } as FindOptionsWhere<Post>;
        tempRelations.push('post');
    }
    if(dto.content) {
        findOptions.where['content'] = Like(`%${dto.content}%`);
    }

    if(dto.parentId) {
        findOptions.where['parent'] = { id: dto.parentId } as FindOptionsWhere<Comment>;
        tempRelations.push('parent');
    }

    return findOptions;
}

