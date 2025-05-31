import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import FollowEntity from "../../entities/Follow.entity";
import { Repository } from "typeorm";
import { RpcException } from "@nestjs/microservices";

@Injectable()
export default class FollowService {
    private readonly logger = new Logger('Social Service | Follow Service')
    constructor(@InjectRepository(FollowEntity) private readonly followRepo: Repository<FollowEntity>) {}

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

    async getFollowers(followeeId: string) {
        return await this.followRepo.find({ where: { followeeId } });
    }

    async getFollowing(followerId: string) {
        return await this.followRepo.find({ where: { followerId } });
    }

    async getMutuals(userId: string) {
        return await this.followRepo.find({ where: { followerId: userId, isMutual: true } });
    }

    async getFollowerCount(followeeId: string) {
        return await this.followRepo.count({ where: { followeeId } });
    }

    async getFollowingCount(followerId: string) {
        return await this.followRepo.count({ where: { followerId } });
    }
}