import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from '@optimistic-tanuki/models';
import { LeadCommands } from '@optimistic-tanuki/constants';

@Controller()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @MessagePattern({ cmd: LeadCommands.FIND_ALL })
  async findAll(@Payload() filters?: { status?: string; source?: string }) {
    return this.leadsService.findAll(filters);
  }

  @MessagePattern({ cmd: LeadCommands.FIND_ONE })
  async findOne(@Payload() data: { id: string }) {
    return this.leadsService.findOne(data.id);
  }

  @MessagePattern({ cmd: LeadCommands.CREATE })
  async create(@Payload() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @MessagePattern({ cmd: LeadCommands.UPDATE })
  async update(@Payload() data: { id: string; dto: UpdateLeadDto }) {
    return this.leadsService.update(data.id, data.dto);
  }

  @MessagePattern({ cmd: LeadCommands.DELETE })
  async delete(@Payload() data: { id: string }) {
    return this.leadsService.delete(data.id);
  }

  @MessagePattern({ cmd: LeadCommands.GET_STATS })
  async getStats() {
    return this.leadsService.getStats();
  }
}
