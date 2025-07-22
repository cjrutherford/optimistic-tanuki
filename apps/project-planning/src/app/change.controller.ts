import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import { CreateChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models'

@Controller()
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @MessagePattern('createChange')
  create(@Payload() createChangeDto: CreateChangeDto) {
    return this.changeService.create(createChangeDto);
  }

  @MessagePattern('findAllChange')
  findAll() {
    return this.changeService.findAll();
  }

  @MessagePattern('findOneChange')
  findOne(@Payload() id: number) {
    return this.changeService.findOne(id);
  }

  @MessagePattern('updateChange')
  update(@Payload() updateChangeDto: UpdateChangeDto) {
    return this.changeService.update(updateChangeDto.id, updateChangeDto);
  }

  @MessagePattern('removeChange')
  remove(@Payload() id: number) {
    return this.changeService.remove(id);
  }
}
