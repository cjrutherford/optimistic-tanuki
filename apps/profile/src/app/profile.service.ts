import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FindManyOptions, FindOneOptions, Repository } from "typeorm";
import { Profile } from "../profiles/entities/profile.entity";
import { CreateProfileDto } from "../profiles/dto/create-profile.dto";
import { UpdateProfileDto, updateProfileDtoToPartial } from "../profiles/dto/update-profile.dto";

@Injectable()
/**
 * Service for managing user profiles.
 */
@Injectable()
export class ProfileService {
    /**
     * Creates an instance of ProfileService.
     * @param profileRepository The repository for Profile entities.
     */
    constructor(
        @Inject(getRepositoryToken(Profile))
        private readonly profileRepository: Repository<Profile>,
    ) { }

    /**
     * Finds all profiles based on provided query options.
     * @param query Optional find many options.
     * @returns A Promise that resolves to an array of Profile entities.
     */
    async findAll(query?: FindManyOptions<Profile>): Promise<Profile[]> {
        return await this.profileRepository.find(query || {});
    }

    /**
     * Finds a single profile by its ID and query options.
     * @param id The ID of the profile to find.
     * @param query Optional find one options.
     * @returns A Promise that resolves to the found Profile entity.
     */
    async findOne(id: string, query?: FindOneOptions<Profile>): Promise<Profile> {
        return await this.profileRepository.findOne({ where: { id }, ...query});
    }

    /**
     * Creates a new profile.
     * @param profile The data for creating the profile.
     * @returns A Promise that resolves to the created Profile.
     */
    async create(profile: CreateProfileDto): Promise<Profile> {
        const newProfile: Partial<Profile> = {
            userId: profile.userId,
            profileName: profile.name,
            profilePic: profile.profilePic,
            coverPic: profile.coverPic,
            bio: profile.bio,
            location: profile.location,
            occupation: profile.occupation,
            interests: profile.interests,
            skills: profile.skills,
        };
        return await this.profileRepository.save(newProfile);
    }

    /**
     * Updates an existing profile.
     * @param id The ID of the profile to update.
     * @param profile The data for updating the profile.
     * @returns A Promise that resolves to the updated Profile.
     */
    async update(id: string, profile: UpdateProfileDto): Promise<Profile> {
        const partialProfile = updateProfileDtoToPartial(profile);
        await this.profileRepository.update(id, {...partialProfile});
        return await this.profileRepository.findOne({where: { id }});
    }
}