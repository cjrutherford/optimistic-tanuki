import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import FollowEntity from "../../entities/Follow.entity";

/**
 * Service for managing follow relationships between users.
 */
@Injectable()
export default class FollowService {
    private readonly logger = new Logger('Social Service | Follow Service')
    /**
     * Creates an instance of FollowService.
     * @param followRepo The repository for FollowEntity.
     */
    constructor(@InjectRepository(FollowEntity) private readonly followRepo: Repository<FollowEntity>) {}

    /**
     * Establishes a follow relationship between two users.
     * @param followerId The ID of the user who is following.
     * @param followeeId The ID of the user being followed.
     * @returns A Promise that resolves to the created FollowEntity.
     * @throws RpcException if the follow relationship already exists.
     * @throws Error if unable to create the follow relationship.
     */
    async follow(followerId: string, followeeId: string) {
        try {
            const currentFollow = await this.followRepo.findOne({ where: { followerId, followeeId } });
            if(currentFollow) {
                throw new RpcException('Already following');
            }
            const newFollow = await this.followRepo.create({ followerId, followeeId });
            const inverseFollow = await this.followRepo.findOne({ where: { followerId: followeeId, followeeId: followerId } });
            if(inverseFollow) {
                newFollow.isMutual = true;
                inverseFollow.isMutual = true;
                await this.followRepo.save(inverseFollow);
            }
            return await this.followRepo.save(newFollow);
        } catch (error) {
            this.logger.error(`Unable to create follow: ${error.message}`)
            throw new Error(`Unable to create follow: ${error.message}`)
        }
    }

    /**
     * Removes a follow relationship between two users.
     * @param followerId The ID of the user who is unfollowing.
     * @param followeeId The ID of the user being unfollowed.
     * @returns A Promise that resolves to the removed FollowEntity.
     * @throws RpcException if the follow relationship does not exist.
     * @throws Error if unable to unfollow.
     */
    async unfollow(followerId: string, followeeId: string) {
        try {
            const currentFollow = await this.followRepo.findOne({ where: { followerId, followeeId } });
            if(!currentFollow) {
                throw new RpcException('Not following');
            }
            const inverseFollow = await this.followRepo.findOne({ where: { followerId: followeeId, followeeId: followerId } });
            if(inverseFollow) {
                inverseFollow.isMutual = false;
                await this.followRepo.save(inverseFollow);
            }
            return await this.followRepo.remove(currentFollow);
        } catch (error) {
            this.logger.error(`Unable to unfollow: ${error.message}`)
            throw new Error(`Unable to Unfollow: ${error.message}`)
        }
    }

    /**
     * Retrieves the followers of a specific user.
     * @param followeeId The ID of the user whose followers are to be retrieved.
     * @returns A Promise that resolves to an array of FollowEntity representing the followers.
     */
    async getFollowers(followeeId: string) {
        return await this.followRepo.find({ where: { followeeId } });
    }

    /**
     * Retrieves the users that a specific user is following.
     * @param followerId The ID of the user whose following list is to be retrieved.
     * @returns A Promise that resolves to an array of FollowEntity representing the users being followed.
     */
    async getFollowing(followerId: string) {
        return await this.followRepo.find({ where: { followerId } });
    }

    /**
     * Retrieves mutual follows for a specific user.
     * @param userId The ID of the user.
     * @returns A Promise that resolves to an array of FollowEntity representing mutual follows.
     */
    async getMutuals(userId: string) {
        return await this.followRepo.find({ where: { followerId: userId, isMutual: true } });
    }

    /**
     * Retrieves the count of followers for a specific user.
     * @param followeeId The ID of the user whose follower count is to be retrieved.
     * @returns A Promise that resolves to the number of followers.
     */
    async getFollowerCount(followeeId: string) {
        return await this.followRepo.count({ where: { followeeId } });
    }

    /**
     * Retrieves the count of users that a specific user is following.
     * @param followerId The ID of the user whose following count is to be retrieved.
     * @returns A Promise that resolves to the number of users being followed.
     */
    async getFollowingCount(followerId: string) {
        return await this.followRepo.count({ where: { followerId } });
    }
}