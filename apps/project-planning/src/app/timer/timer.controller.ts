import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TimerService } from './timer.service';
import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models';
import { TimerCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @MessagePattern({ cmd: TimerCommands.CREATE })
  async create(
    @Payload() createTimerDto: CreateTimerDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createTimerDto;
    return await this.timerService.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: TimerCommands.FIND_ALL })
  async findAll(@Payload('requestingUserId') requestingUserId?: string) {
    return await this.timerService.findAll(requestingUserId);
  }

  @MessagePattern({ cmd: TimerCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.timerService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: TimerCommands.UPDATE })
  async update(
    @Payload() updateTimerDto: UpdateTimerDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateTimerDto;
    return await this.timerService.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: TimerCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.timerService.remove(id, requestingUserId);
  }
}
