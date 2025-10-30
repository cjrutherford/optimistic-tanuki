import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PermissionCommands,
  RoleCommands,
  AppScopeCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  CreateAppScopeDto,
  UpdateAppScopeDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly client: ClientProxy
  ) {}

  // App Scope endpoints
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new app scope' })
  @Post('app-scope')
  async createAppScope(@Body() createAppScopeDto: CreateAppScopeDto) {
    return await firstValueFrom(
      this.client.send({ cmd: AppScopeCommands.Create }, createAppScopeDto)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get an app scope by ID' })
  @Get('app-scope/:id')
  async getAppScope(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: AppScopeCommands.Get }, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get an app scope by name' })
  @Get('app-scope/by-name/:name')
  async getAppScopeByName(@Param('name') name: string) {
    return await firstValueFrom(
      this.client.send({ cmd: AppScopeCommands.GetByName }, name)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all app scopes' })
  @Get('app-scope')
  async getAllAppScopes() {
    return await firstValueFrom(
      this.client.send({ cmd: AppScopeCommands.GetAll }, {})
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update an app scope' })
  @Put('app-scope/:id')
  async updateAppScope(
    @Param('id') id: string,
    @Body() updateAppScopeDto: UpdateAppScopeDto
  ) {
    return await firstValueFrom(
      this.client.send(
        { cmd: AppScopeCommands.Update },
        { id, ...updateAppScopeDto }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete an app scope' })
  @Delete('app-scope/:id')
  async deleteAppScope(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: AppScopeCommands.Delete }, id)
    );
  }

  // Permission endpoints
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new permission' })
  @Post('permission')
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return await firstValueFrom(
      this.client.send({ cmd: PermissionCommands.Create }, createPermissionDto)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a permission by ID' })
  @Get('permission/:id')
  async getPermission(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: PermissionCommands.Get }, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all permissions' })
  @Get('permission')
  async getAllPermissions() {
    return await firstValueFrom(
      this.client.send({ cmd: PermissionCommands.GetAll }, {})
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a permission' })
  @Put('permission/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto
  ) {
    return await firstValueFrom(
      this.client.send(
        { cmd: PermissionCommands.Update },
        { id, ...updatePermissionDto }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a permission' })
  @Delete('permission/:id')
  async deletePermission(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: PermissionCommands.Delete }, id)
    );
  }

  // Role endpoints
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new role' })
  @Post('role')
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Create }, createRoleDto)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a role by ID' })
  @Get('role/:id')
  async getRole(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Get }, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all roles' })
  @Get('role')
  async getAllRoles() {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.GetAll }, {})
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a role' })
  @Put('role/:id')
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto
  ) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Update }, { id, ...updateRoleDto })
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a role' })
  @Delete('role/:id')
  async deleteRole(@Param('id') id: string) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Delete }, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Add permission to role' })
  @Post('role/:roleId/permission/:permissionId')
  async addPermissionToRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string
  ) {
    return await firstValueFrom(
      this.client.send(
        { cmd: RoleCommands.AddPermission },
        { roleId, permissionId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Remove permission from role' })
  @Delete('role/:roleId/permission/:permissionId')
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string
  ) {
    return await firstValueFrom(
      this.client.send(
        { cmd: RoleCommands.RemovePermission },
        { roleId, permissionId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Assign role to user' })
  @Post('assignment')
  async assignRole(@Body() assignRoleDto: AssignRoleDto) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Assign }, assignRoleDto)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Unassign role from user' })
  @Delete('assignment/:assignmentId')
  async unassignRole(@Param('assignmentId') assignmentId: string) {
    return await firstValueFrom(
      this.client.send({ cmd: RoleCommands.Unassign }, { assignmentId })
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get user roles' })
  @Get('user-roles/:profileId')
  async getUserRoles(
    @Param('profileId') profileId: string,
    @Body() data: { appScope?: string }
  ) {
    return await firstValueFrom(
      this.client.send(
        { cmd: RoleCommands.GetUserRoles },
        { profileId, appScope: data?.appScope }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Check user permission' })
  @Post('check-permission')
  async checkPermission(
    @Body() data: { permission: string; appScope: string; targetId: string }
  ) {
    // Use the profile ID from the authenticated user
    return await firstValueFrom(
      this.client.send(
        { cmd: RoleCommands.CheckPermission },
        {
          profileId: data.targetId,
          ...data,
        }
      )
    );
  }
}
