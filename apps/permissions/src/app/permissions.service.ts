import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../permissions/entities/permission.entity';
import { CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/models';

@Injectable()
export class PermissionsService {
    constructor(
        @InjectRepository(Permission)
        private permissionsRepository: Repository<Permission>,
    ) {}

    async createPermission(createPermissionDto: CreatePermissionDto): Promise<Permission> {
        const permission = this.permissionsRepository.create(createPermissionDto);
        return await this.permissionsRepository.save(permission);
    }

    async getPermission(id: string): Promise<Permission> {
        return await this.permissionsRepository.findOne({ 
            where: { id },
            relations: ['roles']
        });
    }

    async getAllPermissions(query: any): Promise<Permission[]> {
        return await this.permissionsRepository.find(query);
    }

    async updatePermission(id: string, updatePermissionDto: UpdatePermissionDto): Promise<Permission> {
        await this.permissionsRepository.update(id, updatePermissionDto);
        return await this.getPermission(id);
    }

    async deletePermission(id: string): Promise<void> {
        await this.permissionsRepository.delete(id);
    }
}
