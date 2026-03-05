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
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Comment } from './comment.entity';
import { Link } from './link.entity';
import { SearchPostDto } from '@optimistic-tanuki/models';
import { Vote } from './vote.entity';
import { Reaction } from './reaction.entity';
import { SocialComponent } from './social-component.entity';
import { Poll } from './poll.entity';

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

  @OneToMany(() => Reaction, (reaction) => reaction.post)
  reactions: Reaction[];

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @ManyToMany(() => Link, (link) => link.posts)
  links: Link[];

  @OneToMany(() => Attachment, (attachment) => attachment.post)
  attachments: Attachment[];

  @OneToMany(() => SocialComponent, (component) => component.post)
  components: SocialComponent[];

  @OneToOne(() => Poll, (poll) => poll.post)
  poll: Poll;

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

  @Column({ type: 'uuid', nullable: true })
  communityId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ default: false })
  isScheduled: boolean;
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

  if (searchDto?.communityId) {
    where.communityId = searchDto.communityId;
  }

  if (searchDto?.communityId === null) {
    where.communityId = null;
  }

  if (searchDto?.communityIds && searchDto.communityIds.length > 0) {
    where.communityId = In(searchDto.communityIds);
  }

  searchOptions.where = where;
  return searchOptions;
}
