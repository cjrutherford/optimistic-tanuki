import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceTokens, LeadCommands } from '@optimistic-tanuki/constants';
import { CreateLeadDto, UpdateLeadDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadClient: ClientProxy
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all leads' })
  async findAll(
    @Query('status') status?: string,
    @Query('source') source?: string
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ALL }, { status, source })
    );
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get lead statistics' })
  async getStats() {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.GET_STATS }, {})
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  async findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ONE }, { id })
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  async create(@Body() dto: CreateLeadDto) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.CREATE }, dto)
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lead' })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.UPDATE }, { id, dto })
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead' })
  async delete(@Param('id') id: string) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.DELETE }, { id })
    );
  }
}
