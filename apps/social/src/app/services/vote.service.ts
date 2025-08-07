import { Inject, Injectable } from "@nestjs/common";
import { Vote } from "../../entities/vote.entity";
import { Repository, FindOneOptions, FindManyOptions } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreateVoteDto, UpdateVoteDto } from "@optimistic-tanuki/models";

@Injectable()
/**
 * Service for managing votes.
 */
@Injectable()
export class VoteService {
    /**
     * Creates an instance of VoteService.
     * @param voteRepo The repository for Vote entities.
     */
    constructor(@Inject(getRepositoryToken(Vote)) private readonly voteRepo: Repository<Vote>) {}

    /**
     * Creates a new vote.
     * @param createVoteDto The data for creating the vote.
     * @returns A Promise that resolves to the created Vote.
     */
    async create(createVoteDto: CreateVoteDto): Promise<Vote> {
        const vote = await this.voteRepo.create(createVoteDto);
        return await this.voteRepo.save(vote);
    }

    /**
     * Finds all votes based on provided options.
     * @param options Optional find many options.
     * @returns A Promise that resolves to an array of Vote entities.
     */
    async findAll(options?: FindManyOptions<Vote>): Promise<Vote[]> {
        return this.voteRepo.find(options);
    }

    /**
     * Finds a single vote by its ID and options.
     * @param id The ID of the vote to find.
     * @param options Optional find one options.
     * @returns A Promise that resolves to the found Vote entity.
     */
    async findOne(id: number, options?: FindOneOptions<Vote>): Promise<Vote> {
        return await this.voteRepo.findOne({ where: { id }, ...options });
    }

    /**
     * Updates an existing vote.
     * @param id The ID of the vote to update.
     * @param updateVoteDto The data for updating the vote.
     * @returns A Promise that resolves when the vote is updated.
     */
    async update(id: number, updateVoteDto: UpdateVoteDto): Promise<void> {
        await await this.voteRepo.update(id, updateVoteDto);
    }

    /**
     * Removes a vote by its ID.
     * @param id The ID of the vote to remove.
     * @returns A Promise that resolves when the vote is removed.
     */
    async remove(id: number): Promise<void> {
        await this.voteRepo.delete(id);
    }
}