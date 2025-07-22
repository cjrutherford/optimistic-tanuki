import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RiskService } from './risk.service';
import { CreateRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';

@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @MessagePattern('createRisk')
  create(@Payload() createRiskDto: CreateRiskDto) {
    return this.riskService.create(createRiskDto);
  }

  @MessagePattern('findAllRisk')
  findAll() {
    return this.riskService.findAll();
  }

  @MessagePattern('findOneRisk')
  findOne(@Payload() id: number) {
    return this.riskService.findOne(id);
  }

  @MessagePattern('updateRisk')
  update(@Payload() updateRiskDto: UpdateRiskDto) {
    return this.riskService.update(updateRiskDto.id, updateRiskDto);
  }

  @MessagePattern('removeRisk')
  remove(@Payload() id: number) {
    return this.riskService.remove(id);
  }
}
