import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, FindOptions } from 'typeorm';
import { Post } from './post.entity';
import { FindOptionsWhere } from 'typeorm';
import { SearchAttachmentDto } from '@optimistic-tanuki/models';

export enum AttachmentType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    AUDIO = 'AUDIO',
    DOCUMENT = 'DOCUMENT',
};

@Entity()
export class Attachment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    filePath: string;

    @Column({ type: 'enum', enum: AttachmentType, default: AttachmentType.IMAGE })
    type: AttachmentType;

    @ManyToOne(() => Post, post => post.attachments)
    post: Post;
}
export function toFindOptions(searchDto: SearchAttachmentDto): FindOptions<Attachment> {
    const findOptions: FindOptionsWhere<Attachment> = {};

    if (searchDto.filePath) {
        findOptions.filePath = searchDto.filePath;
    }

    if (searchDto.type) {
        findOptions.type = searchDto.type as AttachmentType;
    }

    if (searchDto.name) {
        findOptions.name = searchDto.name;
    }

    return {where: findOptions} as FindOptions<Attachment>;
}