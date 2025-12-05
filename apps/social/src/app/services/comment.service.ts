import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from '../../entities/comment.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreateCommentDto, UpdateCommentDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';
import { Post } from '../../entities/post.entity';

@Injectable()
export class CommentService {
  constructor(
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepo: Repository<Comment>,
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>
  ) {}

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    console.log('Creating comment');
    try {
      console.log('finding post');
      const post = await this.postRepo.findOne({
        where: { id: createCommentDto.postId },
      }); // njsscan-ignore: node_nosqli_injection
      if (!post) {
        console.log('post not found');
        throw new RpcException('Post not found');
      }
      console.log('post found', post);
      const commentToCreate: Partial<Comment> = {
        ...createCommentDto,
        post,
      };
      const comment = await this.commentRepo.create(commentToCreate);
      return await this.commentRepo.save(comment);
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async findAll(options?: FindManyOptions<Comment>): Promise<Comment[]> {
    return await this.commentRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Comment>
  ): Promise<Comment> {
    const finalOptions = { ...options };
    if (finalOptions.where) {
      if (Array.isArray(finalOptions.where)) {
        finalOptions.where = finalOptions.where.map((w) => ({ ...w, id }));
      } else {
        finalOptions.where = { ...finalOptions.where, id };
      }
    } else {
      finalOptions.where = { id };
    }
    return await this.commentRepo.findOne(finalOptions);
  }

  async update(id: string, updateCommentDto: UpdateCommentDto): Promise<void> {
    await this.commentRepo.update(id, updateCommentDto);
  }

  async remove(id: string): Promise<void> {
    await this.commentRepo.delete(id);
  }
}
