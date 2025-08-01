import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RiskService } from './risk.service';
import { CreateRiskDto, QueryRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';
import { RiskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @MessagePattern({ cmd: RiskCommands.CREATE })
  async create(@Payload() createRiskDto: CreateRiskDto) {
    return await this.riskService.create(createRiskDto);
  }

  @MessagePattern({ cmd: RiskCommands.FIND_ALL })
  async findAll(@Payload() query: QueryRiskDto) {
    return await this.riskService.findAll(query);
  }

  @MessagePattern({ cmd: RiskCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.riskService.findOne(id);
  }

  @MessagePattern({ cmd: RiskCommands.UPDATE })
  async update(@Payload() updateRiskDto: UpdateRiskDto) {
    return await this.riskService.update(updateRiskDto.id, updateRiskDto);
  }

  @MessagePattern({ cmd: RiskCommands.REMOVE })
  async remove(@Payload('id') id: string) {
    console.log("🚀 ~ RiskController ~ remove ~ id:", id)
    return await this.riskService.remove(id);
  }
}
