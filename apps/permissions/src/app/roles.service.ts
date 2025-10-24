import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from '@optimistic-tanuki/models';

@Injectable()
export class RolesService {
    constructor(
        @InjectRepository(Role)
        private rolesRepository: Repository<Role>,
        @InjectRepository(Permission)
        private permissionsRepository: Repository<Permission>,
        @InjectRepository(RoleAssignment)
        private roleAssignmentsRepository: Repository<RoleAssignment>,
    ) {}

    async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
        const role = this.rolesRepository.create(createRoleDto);
        return await this.rolesRepository.save(role);
    }

    async getRole(id: string): Promise<Role> {
        return await this.rolesRepository.findOne({ 
            where: { id },
            relations: ['permissions', 'assignments']
        });
    }

    async getAllRoles(query: any): Promise<Role[]> {
        return await this.rolesRepository.find({
            ...query,
            relations: ['permissions']
        });
    }

    async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
        await this.rolesRepository.update(id, updateRoleDto);
        return await this.getRole(id);
    }

    async deleteRole(id: string): Promise<void> {
        await this.rolesRepository.delete(id);
    }

    async addPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
        const role = await this.rolesRepository.findOne({
            where: { id: roleId },
            relations: ['permissions']
        });
        const permission = await this.permissionsRepository.findOne({
            where: { id: permissionId }
        });

        if (!role.permissions) {
            role.permissions = [];
        }

        if (!role.permissions.find(p => p.id === permissionId)) {
            role.permissions.push(permission);
            await this.rolesRepository.save(role);
        }

        return role;
    }

    async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
        const role = await this.rolesRepository.findOne({
            where: { id: roleId },
            relations: ['permissions']
        });

        role.permissions = role.permissions.filter(p => p.id !== permissionId);
        await this.rolesRepository.save(role);

        return role;
    }

    async assignRole(assignRoleDto: AssignRoleDto): Promise<RoleAssignment> {
        const role = await this.rolesRepository.findOne({
            where: { id: assignRoleDto.roleId }
        });

        const assignment = this.roleAssignmentsRepository.create({
            profileId: assignRoleDto.profileId,
            appScope: assignRoleDto.appScope,
            role: role
        });

        return await this.roleAssignmentsRepository.save(assignment);
    }

    async unassignRole(assignmentId: string): Promise<void> {
        await this.roleAssignmentsRepository.delete(assignmentId);
    }

    async getUserRoles(profileId: string, appScope?: string): Promise<RoleAssignment[]> {
        const query: any = { where: { profileId }, relations: ['role', 'role.permissions'] };
        
        if (appScope) {
            query.where.appScope = appScope;
        }

        return await this.roleAssignmentsRepository.find(query);
    }

    async checkPermission(profileId: string, permissionName: string, appScope: string, targetId?: string): Promise<boolean> {
        const assignments = await this.getUserRoles(profileId, appScope);

        for (const assignment of assignments) {
            const hasPermission = assignment.role.permissions.some(p => {
                const nameMatch = p.name === permissionName || p.action === permissionName;
                const targetMatch = !targetId || p.targetId === targetId || !p.targetId;
                return nameMatch && targetMatch;
            });

            if (hasPermission) {
                return true;
            }
        }

        return false;
    }
}
