import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PermissionsService } from '../app/permissions.service';
import { PermissionCommands } from '@optimistic-tanuki/constants';
import { CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/models';

@Controller('permissions')
export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) {}

    @MessagePattern({ cmd: PermissionCommands.Create })
    async createPermission(@Payload() createPermissionDto: CreatePermissionDto) {
        return await this.permissionsService.createPermission(createPermissionDto);
    }

    @MessagePattern({ cmd: PermissionCommands.Get })
    async getPermission(@Payload() id: string) {
        return await this.permissionsService.getPermission(id);
    }

    @MessagePattern({ cmd: PermissionCommands.GetAll })
    async getAllPermissions(@Payload() query?: any) {
        return await this.permissionsService.getAllPermissions(query || {});
    }

    @MessagePattern({ cmd: PermissionCommands.Update })
    async updatePermission(@Payload() data: UpdatePermissionDto) {
        return await this.permissionsService.updatePermission(data.id, data);
    }

    @MessagePattern({ cmd: PermissionCommands.Delete })
    async deletePermission(@Payload() id: string) {
        return await this.permissionsService.deletePermission(id);
    }
}
