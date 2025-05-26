import { Inject, Injectable } from "@nestjs/common";
import { Vote } from "../../entities/vote.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreateVoteDto, UpdateVoteDto } from "@optimistic-tanuki/models";

@Injectable()
export class VoteService {
    constructor(@Inject(getRepositoryToken(Vote)) private readonly voteRepo: Repository<Vote>) {}

    async create(createVoteDto: CreateVoteDto): Promise<Vote> {
        const vote = await this.voteRepo.create(createVoteDto);
        return await this.voteRepo.save(vote);
    }

    async findAll(options?: FindManyOptions<Vote>): Promise<Vote[]> {
        return this.voteRepo.find(options);
    }

    async findOne(id: number, options?: FindOneOptions<Vote>): Promise<Vote> {
        return await this.voteRepo.findOne({ where: { id }, ...options });
    }

    async update(id: number, updateVoteDto: UpdateVoteDto): Promise<void> {
        await await this.voteRepo.update(id, updateVoteDto);
    }

    async remove(id: number): Promise<void> {
        await this.voteRepo.delete(id);
    }
}