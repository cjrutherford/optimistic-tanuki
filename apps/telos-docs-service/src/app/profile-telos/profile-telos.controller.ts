import { Controller } from '@nestjs/common';
import { ProfileTelosService } from './profile-telos.service';
import { MessagePattern } from '@nestjs/microservices';
import { ProfileTelosCommands } from '@optimistic-tanuki/constants';
import { CreateProfileTelosDto, QueryProfileTelosDto, UpdateProfileTelosDto } from '@optimistic-tanuki/models';

@Controller('profile-telos')
export class ProfileTelosController {
    constructor(
        private readonly profileTelosService: ProfileTelosService,
    ) {}

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

    @MessagePattern({ cmd: ProfileTelosCommands.FIND })
    async findProfiles(data: QueryProfileTelosDto) {
        return await this.profileTelosService.findAll(data);
    }
}