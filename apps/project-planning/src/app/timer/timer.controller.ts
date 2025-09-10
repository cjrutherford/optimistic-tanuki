import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TimerService } from './timer.service';
import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models'; 
import { TimerCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @MessagePattern({ cmd: TimerCommands.CREATE })
  async create(@Payload() createTimerDto: CreateTimerDto) {
    return await this.timerService.create(createTimerDto);
  }

  @MessagePattern({ cmd: TimerCommands.FIND_ALL })
  async findAll() {
    return await this.timerService.findAll();
  }

  @MessagePattern({ cmd: TimerCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.timerService.findOne(id);
  }

  @MessagePattern({ cmd: TimerCommands.UPDATE })
  async update(@Payload() updateTimerDto: UpdateTimerDto) {
    return await this.timerService.update(updateTimerDto.id, updateTimerDto);
  }

  @MessagePattern({ cmd: TimerCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.timerService.remove(id);
  }
}
