import { Inject, Injectable } from '@nestjs/common';
import { Vote } from '../../entities/vote.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateVoteDto, UpdateVoteDto } from '@optimistic-tanuki/models';

@Injectable()
export class VoteService {
  constructor(
    @Inject(getRepositoryToken(Vote))
    private readonly voteRepo: Repository<Vote>
  ) {}

  async create(createVoteDto: CreateVoteDto): Promise<Vote> {
    const { postId, ...rest } = createVoteDto;
    const vote = this.voteRepo.create({
      ...rest,
      post: postId ? { id: postId } : undefined,
    } as unknown as Vote);
    return await this.voteRepo.save(vote);
  }

  async findAll(options?: FindManyOptions<Vote>): Promise<Vote[]> {
    return this.voteRepo.find(options);
  }

  async findOne(id: string, options?: FindOneOptions<Vote>): Promise<Vote> {
    return await this.voteRepo.findOne({
      where: { id: id as any },
      ...options,
    });
  }

  async update(id: string, updateVoteDto: UpdateVoteDto): Promise<void> {
    await this.voteRepo.update(id, updateVoteDto);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.voteRepo.delete(id);
    return { success: true };
  }
}
