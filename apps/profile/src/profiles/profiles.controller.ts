import { Controller, Logger } from '@nestjs/common';
import { FindOneOptions, FindManyOptions } from 'typeorm';
import { Profile, BlogRole } from '../profiles/entities/profile.entity';
import { ProfileService } from '../app/profile.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { CreateProfileDto, UpdateProfileDto } from '@optimistic-tanuki/models';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly logger: Logger
  ) {}

  @MessagePattern({ cmd: ProfileCommands.Create })
  async createProfile(@Payload() createProfileDto: CreateProfileDto) {
    return await this.profileService.create(createProfileDto);
  }

  @MessagePattern({ cmd: ProfileCommands.Get })
  async getProfile(
    @Payload()
    data: {
      id?: string;
      userId?: string;
      appScope?: string;
      query?: FindOneOptions<Profile>;
    }
  ) {
    this.logger.debug('getProfile called with data:', JSON.stringify(data));
    // Support both id-based lookup and userId+appScope lookup
    if (data.userId) {
      return await this.profileService.findByUserIdAndAppScope(
        data.userId,
        data.appScope || 'global'
      );
    } else if (data.id) {
      return await this.profileService.findOne(data.id, data.query || {});
    }
    throw new Error('Must provide either id or userId to get profile');
  }

  @MessagePattern({ cmd: ProfileCommands.GetAll })
  async getAllProfiles(@Payload() query: FindManyOptions<Profile>) {
    return await this.profileService.findAll(query || {});
  }

  @MessagePattern({ cmd: ProfileCommands.Update })
  async updateProfile(@Payload() data: UpdateProfileDto) {
    return await this.profileService.update(data.id, data);
  }

  @MessagePattern({ cmd: ProfileCommands.SetBlogRole })
  async setBlogRole(
    @Payload() data: { profileId: string; blogRole: BlogRole }
  ) {
    return await this.profileService.setBlogRole(data.profileId, data.blogRole);
  }

  @MessagePattern({ cmd: ProfileCommands.GetBlogRole })
  async getBlogRole(@Payload() userId: string) {
    return await this.profileService.getBlogRole(userId);
  }
}
