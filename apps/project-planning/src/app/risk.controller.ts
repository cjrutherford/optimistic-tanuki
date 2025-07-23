import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RiskService } from './risk.service';
import { CreateRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';
import { RiskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @MessagePattern(RiskCommands.CREATE)
  create(@Payload() createRiskDto: CreateRiskDto) {
    return this.riskService.create(createRiskDto);
  }

  @MessagePattern(RiskCommands.FIND_ALL)
  findAll() {
    return this.riskService.findAll();
  }

  @MessagePattern(RiskCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.riskService.findOne(id);
  }

  @MessagePattern(RiskCommands.UPDATE)
  update(@Payload() updateRiskDto: UpdateRiskDto) {
    return this.riskService.update(updateRiskDto.id, updateRiskDto);
  }

  @MessagePattern(RiskCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.riskService.remove(id);
  }
}
