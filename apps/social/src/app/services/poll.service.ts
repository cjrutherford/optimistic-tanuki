import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Poll } from '../../entities/poll.entity';
import {
  CreatePollDto,
  UpdatePollDto,
  VotePollDto,
  PollDto,
  PollWithResultsDto,
} from '@optimistic-tanuki/models';

@Injectable()
export class PollService {
  constructor(
    @Inject(getRepositoryToken(Poll))
    private readonly pollRepo: Repository<Poll>
  ) {}

  async create(createPollDto: CreatePollDto): Promise<Poll> {
    const poll = this.pollRepo.create({
      question: createPollDto.question,
      options: createPollDto.options,
      isMultipleChoice: createPollDto.isMultipleChoice || false,
      endsAt: createPollDto.endsAt ? new Date(createPollDto.endsAt) : null,
      showResultsBeforeVote: createPollDto.showResultsBeforeVote ?? true,
      isAnonymous: createPollDto.isAnonymous || false,
      profileId: createPollDto.profileId,
      userId: createPollDto.userId,
      isActive: true,
      votes: [],
    });
    return await this.pollRepo.save(poll);
  }

  async findOne(id: string): Promise<Poll | null> {
    return await this.pollRepo.findOne({ where: { id } });
  }

  async findMany(profileId?: string): Promise<Poll[]> {
    const where: any = {};
    if (profileId) {
      where.profileId = profileId;
    }
    return await this.pollRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updatePollDto: UpdatePollDto): Promise<Poll> {
    const poll = await this.findOne(id);
    if (!poll) {
      throw new Error('Poll not found');
    }

    const updateData: Partial<Poll> = {};
    if (updatePollDto.question !== undefined)
      updateData.question = updatePollDto.question;
    if (updatePollDto.options !== undefined)
      updateData.options = updatePollDto.options;
    if (updatePollDto.isMultipleChoice !== undefined)
      updateData.isMultipleChoice = updatePollDto.isMultipleChoice;
    if (updatePollDto.endsAt !== undefined)
      updateData.endsAt = updatePollDto.endsAt
        ? new Date(updatePollDto.endsAt)
        : null;
    if (updatePollDto.showResultsBeforeVote !== undefined)
      updateData.showResultsBeforeVote = updatePollDto.showResultsBeforeVote;
    if (updatePollDto.isAnonymous !== undefined)
      updateData.isAnonymous = updatePollDto.isAnonymous;
    if (updatePollDto.isActive !== undefined)
      updateData.isActive = updatePollDto.isActive;

    await this.pollRepo.update(id, updateData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.pollRepo.delete(id);
  }

  async vote(voteDto: VotePollDto): Promise<Poll> {
    const poll = await this.findOne(voteDto.pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    if (!poll.isActive) {
      throw new Error('Poll is no longer active');
    }

    if (poll.endsAt && new Date() > poll.endsAt) {
      throw new Error('Poll has ended');
    }

    const currentVotes = poll.votes || [];
    const userId = voteDto.userId;

    let updatedVotes: string[];
    if (poll.isMultipleChoice) {
      const userVotes = this.getUserVotes(currentVotes, userId);
      const newVotes = [...new Set([...userVotes, ...voteDto.optionIndices])];
      updatedVotes = this.setUserVotes(currentVotes, userId, newVotes);
    } else {
      updatedVotes = this.setUserVotes(currentVotes, userId, [
        voteDto.optionIndices[0],
      ]);
    }

    await this.pollRepo.update(voteDto.pollId, { votes: updatedVotes });
    return await this.findOne(voteDto.pollId);
  }

  async removeVote(pollId: string, userId: string): Promise<Poll> {
    const poll = await this.findOne(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    const currentVotes = poll.votes || [];
    const updatedVotes = this.removeUserVotes(currentVotes, userId);

    await this.pollRepo.update(pollId, { votes: updatedVotes });
    return await this.findOne(pollId);
  }

  async getPollWithResults(
    pollId: string,
    userId?: string
  ): Promise<PollWithResultsDto | null> {
    const poll = await this.findOne(pollId);
    if (!poll) {
      return null;
    }

    const totalVotes = this.countTotalVotes(poll.votes || []);
    const optionResults = poll.options.map((option, index) => {
      const count = this.countVotesForOption(poll.votes || [], index);
      return {
        option,
        count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      };
    });

    let userVoted = false;
    let userVoteOptions: number[] = [];
    if (userId) {
      const userVotes = this.getUserVotes(poll.votes || [], userId);
      userVoted = userVotes.length > 0;
      userVoteOptions = userVotes;
    }

    return {
      ...poll,
      totalVotes,
      optionResults,
      userVoted,
      userVoteOptions,
    };
  }

  private getUserVotes(votes: string[], userId: string): number[] {
    for (const voteEntry of votes) {
      try {
        const parsed = JSON.parse(voteEntry);
        if (parsed.userId === userId) {
          return parsed.optionIndices || [];
        }
      } catch {
        continue;
      }
    }
    return [];
  }

  private setUserVotes(
    votes: string[],
    userId: string,
    optionIndices: number[]
  ): string[] {
    const filteredVotes = votes.filter((v) => {
      try {
        const parsed = JSON.parse(v);
        return parsed.userId !== userId;
      } catch {
        return true;
      }
    });

    filteredVotes.push(JSON.stringify({ userId, optionIndices }));
    return filteredVotes;
  }

  private removeUserVotes(votes: string[], userId: string): string[] {
    return votes.filter((v) => {
      try {
        const parsed = JSON.parse(v);
        return parsed.userId !== userId;
      } catch {
        return true;
      }
    });
  }

  private countTotalVotes(votes: string[]): number {
    let total = 0;
    for (const voteEntry of votes) {
      try {
        const parsed = JSON.parse(voteEntry);
        if (parsed.optionIndices && Array.isArray(parsed.optionIndices)) {
          total += parsed.optionIndices.length;
        }
      } catch {
        continue;
      }
    }
    return total;
  }

  private countVotesForOption(votes: string[], optionIndex: number): number {
    let count = 0;
    for (const voteEntry of votes) {
      try {
        const parsed = JSON.parse(voteEntry);
        if (parsed.optionIndices && Array.isArray(parsed.optionIndices)) {
          if (parsed.optionIndices.includes(optionIndex)) {
            count++;
          }
        }
      } catch {
        continue;
      }
    }
    return count;
  }
}
