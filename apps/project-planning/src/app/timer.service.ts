import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models';

import { Injectable } from '@nestjs/common';

@Injectable()
export class TimerService {
  create(createTimerDto: CreateTimerDto) {
    return 'This action adds a new timer';
  }

  findAll() {
    return `This action returns all timer`;
  }

  findOne(id: number) {
    return `This action returns a #${id} timer`;
  }

  update(id: number, updateTimerDto: UpdateTimerDto) {
    return `This action updates a #${id} timer`;
  }

  remove(id: number) {
    return `This action removes a #${id} timer`;
  }
}
