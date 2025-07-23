import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TimerService } from './timer.service';
import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models'; 
import { TimerCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @MessagePattern(TimerCommands.CREATE)
  create(@Payload() createTimerDto: CreateTimerDto) {
    return this.timerService.create(createTimerDto);
  }

  @MessagePattern(TimerCommands.FIND_ALL)
  findAll() {
    return this.timerService.findAll();
  }

  @MessagePattern(TimerCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.timerService.findOne(id);
  }

  @MessagePattern(TimerCommands.UPDATE)
  update(@Payload() updateTimerDto: UpdateTimerDto) {
    return this.timerService.update(updateTimerDto.id, updateTimerDto);
  }

  @MessagePattern(TimerCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.timerService.remove(id);
  }
}
