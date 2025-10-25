import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { CreateAppScopeDto, UpdateAppScopeDto } from '@optimistic-tanuki/models';

@Injectable()
export class AppScopesService {
    constructor(
        @InjectRepository(AppScope)
        private appScopesRepository: Repository<AppScope>,
    ) {}

    async createAppScope(createAppScopeDto: CreateAppScopeDto): Promise<AppScope> {
        const appScope = this.appScopesRepository.create(createAppScopeDto);
        return await this.appScopesRepository.save(appScope);
    }

    async getAppScope(id: string): Promise<AppScope> {
        return await this.appScopesRepository.findOne({ where: { id } });
    }

    async getAppScopeByName(name: string): Promise<AppScope> {
        return await this.appScopesRepository.findOne({ where: { name } });
    }

    async getAllAppScopes(query: any): Promise<AppScope[]> {
        return await this.appScopesRepository.find(query);
    }

    async updateAppScope(id: string, updateAppScopeDto: UpdateAppScopeDto): Promise<AppScope> {
        await this.appScopesRepository.update(id, updateAppScopeDto);
        return await this.getAppScope(id);
    }

    async deleteAppScope(id: string): Promise<void> {
        await this.appScopesRepository.delete(id);
    }
}
