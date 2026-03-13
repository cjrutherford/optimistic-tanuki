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
import { AppConfigCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { AuthGuard } from '../../auth/auth.guard';
import { firstValueFrom } from 'rxjs';
import { User, UserDetails } from '../../decorators/user.decorator';

@ApiTags('app-config')
@Controller('app-config')
export class AppConfigController {
  constructor(
    private readonly logger: Logger,
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly client: ClientProxy
  ) {}

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new app configuration' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully' })
  @Post()
  async createConfiguration(
    @Body() createDto: CreateAppConfigDto,
    @User() user: UserDetails
  ) {
    this.logger.log(`Creating app configuration for user ${user.profileId}`);
    // Set ownerId to the current user's profileId
    const dtoWithOwner = {
      ...createDto,
      ownerId: user.profileId,
    };
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.Create }, dtoWithOwner)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all app configurations' })
  @ApiResponse({ status: 200, description: 'Configurations retrieved' })
  @Get()
  async getAllConfigurations() {
    this.logger.log('Getting all app configurations');
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.GetAll }, {})
    );
  }

  @ApiOperation({ summary: 'Get app configuration by domain' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get('by-domain/:domain')
  async getConfigurationByDomain(@Param('domain') domain: string) {
    this.logger.log(`Getting app configuration by domain: ${domain}`);
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.GetByDomain }, { domain })
    );
  }

  @ApiOperation({ summary: 'Get app configuration by name' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get('by-name/:name')
  async getConfigurationByName(@Param('name') name: string) {
    this.logger.log(`Getting app configuration by name: ${name}`);
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.GetByName }, { name })
    );
  }

  @ApiOperation({ summary: 'Get app configuration by ID' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get(':id')
  async getConfiguration(@Param('id') id: string) {
    this.logger.log(`Getting app configuration: ${id}`);
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.Get }, id)
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update app configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Put(':id')
  async updateConfiguration(
    @Param('id') id: string,
    @Body() updateDto: UpdateAppConfigDto
  ) {
    this.logger.log(`Updating app configuration: ${id}`);
    return await firstValueFrom(
      this.client.send(
        { cmd: AppConfigCommands.Update },
        { id, ...updateDto }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete app configuration' })
  @ApiResponse({ status: 200, description: 'Configuration deleted' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Delete(':id')
  async deleteConfiguration(@Param('id') id: string) {
    this.logger.log(`Deleting app configuration: ${id}`);
    return await firstValueFrom(
      this.client.send({ cmd: AppConfigCommands.Delete }, id)
    );
  }
}
