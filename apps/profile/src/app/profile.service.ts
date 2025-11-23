import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { Profile, BlogRole } from '../profiles/entities/profile.entity';
import { CreateProfileDto } from '../profiles/dto/create-profile.dto';
import {
  UpdateProfileDto,
  updateProfileDtoToPartial,
} from '../profiles/dto/update-profile.dto';
import { SetBlogRoleDto } from '../profiles/dto/set-blog-role.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(getRepositoryToken(Profile))
    private readonly profileRepository: Repository<Profile>
  ) {}

  async findAll(query?: FindManyOptions<Profile>): Promise<Profile[]> {
    return await this.profileRepository.find(query || {});
  }

  async findOne(id: string, query?: FindOneOptions<Profile>): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { id }, ...query });
  }

  async findByUserId(userId: string): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { userId } });
  }

  async findByUserIdAndAppScope(userId: string, appScope: string): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { userId, appScope } });
  }

  async create(profile: CreateProfileDto & { appScope?: string }): Promise<Profile> {
    const newProfile: Partial<Profile> = {
      userId: profile.userId,
      appScope: profile.appScope || null,
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

  async update(id: string, profile: UpdateProfileDto): Promise<Profile> {
    const partialProfile = updateProfileDtoToPartial(profile);
    await this.profileRepository.update(id, {
      ...partialProfile,
      bio: partialProfile.bio || '',
    });
    return await this.profileRepository.findOne({ where: { id } });
  }

  async setBlogRole(profileId: string, blogRole: BlogRole): Promise<Profile> {
    await this.profileRepository.update(profileId, { blogRole });
    return await this.profileRepository.findOne({ where: { id: profileId } });
  }

  async getBlogRole(userId: string): Promise<BlogRole> {
    const profile = await this.findByUserId(userId);
    return profile?.blogRole || BlogRole.NONE;
  }
}
