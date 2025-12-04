import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RolesService } from '../app/roles.service';
import { RoleCommands } from '@optimistic-tanuki/constants';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
} from '@optimistic-tanuki/models';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @MessagePattern({ cmd: RoleCommands.Create })
  async createRole(@Payload() createRoleDto: CreateRoleDto) {
    return await this.rolesService.createRole(createRoleDto);
  }

  @MessagePattern({ cmd: RoleCommands.Get })
  async getRole(@Payload() id: string) {
    return await this.rolesService.getRole(id);
  }

  @MessagePattern({ cmd: RoleCommands.GetByName })
  async getRoleByName(@Payload() data: { name: string; appScope?: string }) {
    return await this.rolesService.getRoleByName(data.name, data.appScope);
  }

  @MessagePattern({ cmd: RoleCommands.GetAll })
  async getAllRoles(@Payload() query?: any) {
    return await this.rolesService.getAllRoles(query || {});
  }

  @MessagePattern({ cmd: RoleCommands.Update })
  async updateRole(@Payload() data: UpdateRoleDto) {
    return await this.rolesService.updateRole(data.id, data);
  }

  @MessagePattern({ cmd: RoleCommands.Delete })
  async deleteRole(@Payload() id: string) {
    return await this.rolesService.deleteRole(id);
  }

  @MessagePattern({ cmd: RoleCommands.AddPermission })
  async addPermissionToRole(
    @Payload() data: { roleId: string; permissionId: string }
  ) {
    return await this.rolesService.addPermissionToRole(
      data.roleId,
      data.permissionId
    );
  }

  @MessagePattern({ cmd: RoleCommands.RemovePermission })
  async removePermissionFromRole(
    @Payload() data: { roleId: string; permissionId: string }
  ) {
    return await this.rolesService.removePermissionFromRole(
      data.roleId,
      data.permissionId
    );
  }

  @MessagePattern({ cmd: RoleCommands.Assign })
  async assignRole(@Payload() assignRoleDto: AssignRoleDto) {
    return await this.rolesService.assignRole(assignRoleDto);
  }

  @MessagePattern({ cmd: RoleCommands.Unassign })
  async unassignRole(@Payload() data: { assignmentId: string }) {
    return await this.rolesService.unassignRole(data.assignmentId);
  }

  @MessagePattern({ cmd: RoleCommands.GetUserRoles })
  async getUserRoles(
    @Payload() data: { profileId: string; appScope?: string }
  ) {
    return await this.rolesService.getUserRoles(data.profileId, data.appScope);
  }

  @MessagePattern({ cmd: RoleCommands.CheckPermission })
  async checkPermission(
    @Payload()
    data: {
      profileId: string;
      permission: string;
      appScopeId: string;
      profileAppScope?: string;
      targetId?: string;
    }
  ) {
    return await this.rolesService.checkPermission(
      data.profileId,
      data.permission,
      data.appScopeId,
      data.targetId
    );
  }
}
