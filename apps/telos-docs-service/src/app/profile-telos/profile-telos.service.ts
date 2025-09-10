import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileTelos } from '../entities';
import { Any, FindOptionsWhere, Like, Repository } from 'typeorm';
import { CreateProfileTelosDto, ProfileTelosDto, QueryProfileTelosDto, UpdateProfileTelosDto } from '@optimistic-tanuki/models';

@Injectable()
export class ProfileTelosService {
    constructor(
        @Inject(getRepositoryToken(ProfileTelos))
        private readonly profileRepository: Repository<ProfileTelos>,
    ) {}

    async create(data: CreateProfileTelosDto) {
        const profile = this.profileRepository.create(data);
        return await this.profileRepository.save(profile);
    }

    async findAll(query: QueryProfileTelosDto): Promise<ProfileTelosDto[]> {
        const where: FindOptionsWhere<ProfileTelos> = {};

        if(query.name) {
            where.name = query.name;
        }

        if(query.description) {
            where.description = query.description;
        }

        if(query.goals) {
            where.goals = Any(query.goals);
        }

        if(query.skills) {
            where.skills = Any(query.skills);
        }

        if(query.interests) {
            where.interests = Any(query.interests);
        }

        if(query.limitations) {
            where.limitations = Any(query.limitations);
        }

        if(query.strengths) {
            where.strengths = Any(query.strengths);
        }

        if(query.objectives) {
            where.objectives = Any(query.objectives);
        }

        if(query.coreObjective) {
            where.coreObjective = Like(`%${query.coreObjective}%`);
        }

        return await this.profileRepository.find({ where });
    }

    async findOne(id: string): Promise<ProfileTelosDto | null> {
        return await this.profileRepository.findOne({ where: { id } });
    }

    async update(id: string, data: UpdateProfileTelosDto): Promise<ProfileTelos | null> {
        await this.profileRepository.update(id, data);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.profileRepository.delete(id);
    }
}
