import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>
  ) {}

  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = await this.postRepo.create(createPostDto);
    return await this.postRepo.save(post);
  }

  async findAll(options?: FindManyOptions<Post>): Promise<Post[]> {
    return await this.postRepo.find(options);
  }

  async findOne(id: string, options?: FindOneOptions<Post>): Promise<Post> {
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
    return await this.postRepo.findOne(finalOptions);
  }

  async update(id: number, updatePostDto: UpdatePostDto): Promise<void> {
    await this.postRepo.update(id, updatePostDto);
  }

  async remove(id: number): Promise<void> {
    await this.postRepo.delete(id);
  }
}
