import { Controller } from '@nestjs/common';
import { ProfileTelosService } from './profile-telos.service';
import { MessagePattern } from '@nestjs/microservices';
import { ProfileTelosCommands } from '@optimistic-tanuki/constants';
import {
  CreateProfileTelosDto,
  GetProfileTelosByProfileIdDto,
  QueryProfileTelosDto,
  UpdateProfileTelosDto,
  UpsertProfileTelosSourceDto,
} from '@optimistic-tanuki/models';

@Controller('profile-telos')
export class ProfileTelosController {
  constructor(private readonly profileTelosService: ProfileTelosService) {}

  @MessagePattern({ cmd: ProfileTelosCommands.CREATE })
  async createProfile(data: CreateProfileTelosDto) {
    return await this.profileTelosService.create(data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.UPDATE })
  async updateProfile(data: UpdateProfileTelosDto) {
    return await this.profileTelosService.update(data.id, data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.DELETE })
  async deleteProfile(data: string) {
    return await this.profileTelosService.remove(data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.FIND_ONE })
  async findProfile(data: string) {
    return await this.profileTelosService.findOne(data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.FIND_BY_PROFILE_ID })
  async findProfileByProfileId(data: GetProfileTelosByProfileIdDto) {
    return await this.profileTelosService.findByProfileId(data.profileId);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.FIND })
  async findProfiles(data: QueryProfileTelosDto) {
    return await this.profileTelosService.findAll(data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.UPSERT_SOURCE })
  async upsertProfileSource(data: UpsertProfileTelosSourceDto) {
    return await this.profileTelosService.upsertSource(data);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.REGENERATE })
  async regenerateProfile(data: GetProfileTelosByProfileIdDto) {
    return await this.profileTelosService.regenerate(data.profileId);
  }

  @MessagePattern({ cmd: ProfileTelosCommands.RESET_DERIVED })
  async resetDerivedProfile(data: GetProfileTelosByProfileIdDto) {
    return await this.profileTelosService.resetDerived(data.profileId);
  }
}
