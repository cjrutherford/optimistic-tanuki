import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppScopesService } from '../app/app-scopes.service';
import { AppScopeCommands } from '@optimistic-tanuki/constants';
import {
  CreateAppScopeDto,
  UpdateAppScopeDto,
} from '@optimistic-tanuki/models';

@Controller('app-scopes')
export class AppScopesController {
  constructor(
    private readonly appScopesService: AppScopesService,
    private readonly logger: Logger
  ) {}

  @MessagePattern({ cmd: AppScopeCommands.Create })
  async createAppScope(@Payload() createAppScopeDto: CreateAppScopeDto) {
    return await this.appScopesService.createAppScope(createAppScopeDto);
  }

  @MessagePattern({ cmd: AppScopeCommands.Get })
  async getAppScope(@Payload() id: string) {
    return await this.appScopesService.getAppScope(id);
  }

  @MessagePattern({ cmd: AppScopeCommands.GetByName })
  async getAppScopeByName(@Payload('name') name: string) {
    this.logger.log(`Getting AppScope by name: ${name}`);
    return await this.appScopesService.getAppScopeByName(name);
  }

  @MessagePattern({ cmd: AppScopeCommands.GetAll })
  async getAllAppScopes(@Payload() query?: any) {
    return await this.appScopesService.getAllAppScopes(query || {});
  }

  @MessagePattern({ cmd: AppScopeCommands.Update })
  async updateAppScope(@Payload() data: UpdateAppScopeDto) {
    return await this.appScopesService.updateAppScope(data.id, data);
  }

  @MessagePattern({ cmd: AppScopeCommands.Delete })
  async deleteAppScope(@Payload() id: string) {
    return await this.appScopesService.deleteAppScope(id);
  }
}
