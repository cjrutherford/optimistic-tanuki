import { Inject, Injectable } from '@nestjs/common';
import { Vote } from '../../entities/vote.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateVoteDto, UpdateVoteDto } from '@optimistic-tanuki/models';

export interface CastVoteResult {
  vote: Vote | null;
  created: boolean;
  changed: boolean;
}

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

  async castVote(
    postId: string,
    profileId: string,
    userId: string,
    value: number
  ): Promise<CastVoteResult> {
    const existing = await this.voteRepo.findOne({
      where: { post: { id: postId }, profileId },
      relations: ['post'],
    });

    if (value === 0) {
      if (!existing) {
        return { vote: null, created: false, changed: false };
      }
      await this.voteRepo.delete(existing.id);
      return { vote: null, created: false, changed: true };
    }

    if (existing) {
      if (existing.value === value) {
        return { vote: existing, created: false, changed: false };
      }
      existing.value = value;
      const saved = await this.voteRepo.save(existing);
      return { vote: saved, created: false, changed: true };
    }

    const vote = this.voteRepo.create({
      value,
      userId,
      profileId,
      post: { id: postId },
    } as unknown as Vote);
    const saved = await this.voteRepo.save(vote);
    return { vote: saved, created: true, changed: true };
  }

  async removeVoteByPostAndProfile(
    postId: string,
    profileId: string
  ): Promise<{ success: boolean }> {
    const existing = await this.voteRepo.findOne({
      where: { post: { id: postId }, profileId },
      relations: ['post'],
    });
    if (!existing) {
      return { success: true };
    }
    await this.voteRepo.delete(existing.id);
    return { success: true };
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
