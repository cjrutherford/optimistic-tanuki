import { Attachment, AttachmentType } from './attachment.entity';
/* istanbul ignore file */
import {
  Column,
  Entity,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Like,
  ManyToMany,
  MoreThanOrEqual,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Comment } from './comment.entity';
import { Link } from './link.entity';
import { SearchPostDto } from '@optimistic-tanuki/models';
import { Vote } from './vote.entity';
import { SocialComponent } from './social-component.entity';

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

  @Column({ type: 'varchar', default: 'social' })
  appScope: string;

  @OneToMany(() => Vote, (vote) => vote.post)
  votes: Vote[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @ManyToMany(() => Link, (link) => link.posts)
  links: Link[];

  @OneToMany(() => Attachment, (attachment) => attachment.post)
  attachments: Attachment[];

  @OneToMany(() => SocialComponent, (component) => component.post)
  components: SocialComponent[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'varchar', default: 'public' })
  visibility: 'public' | 'followers';
}

export function postSearchDtoToFindManyOptions(
  searchDto: SearchPostDto
): FindManyOptions<Post> {
  const searchOptions: FindManyOptions<Post> = {};
  const where: FindOptionsWhere<Post> = {};

  if (searchDto?.title) {
    where.title = Like(`%${searchDto.title}%`);
  }

  if (searchDto?.content) {
    where.content = Like(`%${searchDto.content}%`);
  }

  if (searchDto?.userIds && searchDto.userIds.length > 0) {
    where.userId = In(searchDto.userIds);
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

  if (searchDto?.visibility) {
    where.visibility = searchDto.visibility;
  }

  searchOptions.where = where;
  return searchOptions;
}
