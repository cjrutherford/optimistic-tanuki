import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RiskService } from './risk.service';
import {
  CreateRiskDto,
  QueryRiskDto,
  UpdateRiskDto,
} from '@optimistic-tanuki/models';
import { RiskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @MessagePattern({ cmd: RiskCommands.CREATE })
  async create(
    @Payload() createRiskDto: CreateRiskDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createRiskDto;
    return await this.riskService.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: RiskCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryRiskDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.riskService.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: RiskCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.riskService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: RiskCommands.UPDATE })
  async update(
    @Payload() updateRiskDto: UpdateRiskDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateRiskDto;
    return await this.riskService.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: RiskCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.riskService.remove(id, requestingUserId);
  }
}
