import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
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
        @InjectRepository(AppScope)
        private appScopesRepository: Repository<AppScope>,
    ) {}

    async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
        const appScope = await this.appScopesRepository.findOne({
            where: { id: createRoleDto.appScopeId }
        });
        
        const role = this.rolesRepository.create({
            name: createRoleDto.name,
            description: createRoleDto.description,
            appScope
        });
        return await this.rolesRepository.save(role);
    }

    async getRole(id: string): Promise<Role> {
        return await this.rolesRepository.findOne({ 
            where: { id },
            relations: ['permissions', 'assignments', 'appScope']
        });
    }

    async getAllRoles(query: any): Promise<Role[]> {
        return await this.rolesRepository.find({
            ...query,
            relations: ['permissions', 'appScope']
        });
    }

    async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
        const updateData: any = {
            name: updateRoleDto.name,
            description: updateRoleDto.description
        };
        
        if (updateRoleDto.appScopeId) {
            const appScope = await this.appScopesRepository.findOne({
                where: { id: updateRoleDto.appScopeId }
            });
            updateData.appScope = appScope;
        }
        
        await this.rolesRepository.update(id, updateData);
        return await this.getRole(id);
    }

    async deleteRole(id: string): Promise<void> {
        await this.rolesRepository.delete(id);
    }

    async addPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
        const role = await this.rolesRepository.findOne({
            where: { id: roleId },
            relations: ['permissions', 'appScope']
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
            relations: ['permissions', 'appScope']
        });

        role.permissions = role.permissions.filter(p => p.id !== permissionId);
        await this.rolesRepository.save(role);

        return role;
    }

    async assignRole(assignRoleDto: AssignRoleDto): Promise<RoleAssignment> {
        const role = await this.rolesRepository.findOne({
            where: { id: assignRoleDto.roleId }
        });
        
        const appScope = await this.appScopesRepository.findOne({
            where: { id: assignRoleDto.appScopeId }
        });

        const assignment = this.roleAssignmentsRepository.create({
            profileId: assignRoleDto.profileId,
            appScope,
            role
        });

        return await this.roleAssignmentsRepository.save(assignment);
    }

    async unassignRole(assignmentId: string): Promise<void> {
        await this.roleAssignmentsRepository.delete(assignmentId);
    }

    async getUserRoles(profileId: string, appScopeId?: string): Promise<RoleAssignment[]> {
        const queryBuilder = this.roleAssignmentsRepository
            .createQueryBuilder('assignment')
            .leftJoinAndSelect('assignment.role', 'role')
            .leftJoinAndSelect('role.permissions', 'permissions')
            .leftJoinAndSelect('assignment.appScope', 'appScope')
            .where('assignment.profileId = :profileId', { profileId });
        
        if (appScopeId) {
            queryBuilder.andWhere('appScope.id = :appScopeId', { appScopeId });
        }

        return await queryBuilder.getMany();
    }

    async checkPermission(profileId: string, permissionName: string, appScopeId: string, targetId?: string): Promise<boolean> {
        const assignments = await this.getUserRoles(profileId, appScopeId);

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
