import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import { CreateChangeDto, QueryChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models'
import { ChangeCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @MessagePattern({ cmd: ChangeCommands.CREATE })
  async create(@Payload() createChangeDto: CreateChangeDto) {
    return await this.changeService.create(createChangeDto);
  }

  @MessagePattern({ cmd: ChangeCommands.FIND_ALL })
  async findAll(@Payload() query: QueryChangeDto) {
    return await this.changeService.findAll(query);
  }

  @MessagePattern({ cmd: ChangeCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.changeService.findOne(id);
  }

  @MessagePattern({ cmd: ChangeCommands.UPDATE })
  async update(@Payload() updateChangeDto: UpdateChangeDto) {
    return await this.changeService.update(updateChangeDto.id, updateChangeDto);
  }

  @MessagePattern({ cmd: ChangeCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.changeService.remove(id);
  }
}
