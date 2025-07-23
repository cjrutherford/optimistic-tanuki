import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import { CreateChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models'
import { ChangeCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @MessagePattern(ChangeCommands.CREATE)
  create(@Payload() createChangeDto: CreateChangeDto) {
    return this.changeService.create(createChangeDto);
  }

  @MessagePattern(ChangeCommands.FIND_ALL)
  findAll() {
    return this.changeService.findAll();
  }

  @MessagePattern(ChangeCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.changeService.findOne(id);
  }

  @MessagePattern(ChangeCommands.UPDATE)
  update(@Payload() updateChangeDto: UpdateChangeDto) {
    return this.changeService.update(updateChangeDto.id, updateChangeDto);
  }

  @MessagePattern(ChangeCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.changeService.remove(id);
  }
}
