import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostShare } from '../../entities/post-share.entity';
import { CreatePostShareDto, PostShareDto } from '@optimistic-tanuki/models';

@Injectable()
export class PostShareService {
  constructor(
    @Inject(getRepositoryToken(PostShare))
    private readonly postShareRepo: Repository<PostShare>
  ) {}

  async create(createPostShareDto: CreatePostShareDto): Promise<PostShare> {
    const postShare = this.postShareRepo.create({
      originalPostId: createPostShareDto.originalPostId,
      sharedById: createPostShareDto.sharedById,
      comment: createPostShareDto.comment,
      visibility: createPostShareDto.visibility || 'public',
      communityId: createPostShareDto.communityId,
    });
    return await this.postShareRepo.save(postShare);
  }

  async findById(id: string): Promise<PostShare | null> {
    return await this.postShareRepo.findOne({ where: { id } });
  }

  async findByPost(originalPostId: string): Promise<PostShare[]> {
    return await this.postShareRepo.find({
      where: { originalPostId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProfile(profileId: string): Promise<PostShare[]> {
    return await this.postShareRepo.find({
      where: { sharedById: profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.postShareRepo.delete(id);
  }
}
