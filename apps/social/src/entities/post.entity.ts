import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, In, Like, MoreThanOrEqual, FindOptionsWhere, FindManyOptions } from 'typeorm';
import { Vote } from './vote.entity';
import { Comment } from './comment.entity';
import { Link } from './link.entity';
import { Attachment, AttachmentType } from './attachment.entity';
import { SearchPostDto } from '@optimistic-tanuki/models';

@Entity()
export class Post {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column()
    content: string;

    @Column()
    profileId: string;

    @Column()
    userId: string; 

    @OneToMany(() => Vote, vote => vote.post)
    votes: Vote[];

    @OneToMany(() => Comment, comment => comment.post)
    comments: Comment[];

    @ManyToMany(() => Link, link => link.posts)
    links: Link[];

    @OneToMany(() => Attachment, attachment => attachment.post)
    attachments: Attachment[];

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}

export function postSearchDtoToFindManyOptions(searchDto: SearchPostDto): FindManyOptions<Post> {
    const searchOptions: FindManyOptions<Post> = {};
    const where: FindOptionsWhere<Post> = {};

    if (searchDto?.title) {
        where.title = Like(`%${searchDto.title}%`);
    }

    if (searchDto?.content) {
        where.content = Like(`%${searchDto.content}%`);
    }

    if (searchDto?.userId) {
        where.userId = searchDto.userId;
    }

    if (searchDto?.commentContent) {
        where.comments = { content: Like(`%${searchDto.commentContent}%`) };
    }

    if (searchDto?.linkUrl) {
        where.links = { url: Like(`%${searchDto.linkUrl}%`) };
    }

    if (searchDto?.attachmentUrl) {
        where.attachments = { filePath: Like(`%${searchDto.attachmentUrl}%`) };
    }

    if (searchDto?.attachmentType) {
        where.attachments = { type: searchDto.attachmentType as AttachmentType };
    }
    searchOptions.where = where;
    return searchOptions;
}