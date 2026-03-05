import { Inject, Injectable } from '@nestjs/common';
import { Reaction } from '../../entities/reaction.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateReactionDto,
  UpdateReactionDto,
} from '@optimistic-tanuki/models';

@Injectable()
export class ReactionService {
  constructor(
    @Inject(getRepositoryToken(Reaction))
    private readonly reactionRepo: Repository<Reaction>
  ) {}

  async create(createReactionDto: CreateReactionDto): Promise<Reaction> {
    const { postId, commentId, ...rest } = createReactionDto;

    const reaction = this.reactionRepo.create({
      ...rest,
      post: postId ? { id: postId } : undefined,
      comment: commentId ? { id: commentId } : undefined,
    } as unknown as Reaction);

    return await this.reactionRepo.save(reaction);
  }

  async findAll(options?: FindManyOptions<Reaction>): Promise<Reaction[]> {
    return this.reactionRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Reaction>
  ): Promise<Reaction | null> {
    return await this.reactionRepo.findOne({
      where: { id } as any,
      ...options,
    });
  }

  async findByPostId(postId: string): Promise<Reaction[]> {
    return this.reactionRepo.find({
      where: { post: { id: postId } },
      relations: ['post'],
    });
  }

  async findByCommentId(commentId: string): Promise<Reaction[]> {
    return this.reactionRepo.find({
      where: { comment: { id: commentId } },
      relations: ['comment'],
    });
  }

  async findUserReaction(
    userId: string,
    postId?: string,
    commentId?: string
  ): Promise<Reaction | null> {
    const where: any = { userId };
    if (postId) {
      where.post = { id: postId };
    }
    if (commentId) {
      where.comment = { id: commentId };
    }

    return await this.reactionRepo.findOne({
      where,
    });
  }

  async update(
    id: string,
    updateReactionDto: UpdateReactionDto
  ): Promise<void> {
    await this.reactionRepo.update(id, updateReactionDto);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.reactionRepo.delete(id);
    return { success: true };
  }

  async getReactionCounts(
    postId: string
  ): Promise<{ [value: number]: number }> {
    const reactions = await this.findByPostId(postId);
    const counts: { [value: number]: number } = {};

    for (const reaction of reactions) {
      counts[reaction.value] = (counts[reaction.value] || 0) + 1;
    }

    return counts;
  }

  async getCommentReactionCounts(
    commentId: string
  ): Promise<{ [value: number]: number }> {
    const reactions = await this.findByCommentId(commentId);
    const counts: { [value: number]: number } = {};

    for (const reaction of reactions) {
      counts[reaction.value] = (counts[reaction.value] || 0) + 1;
    }

    return counts;
  }
}
