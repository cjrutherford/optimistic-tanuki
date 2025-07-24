import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Timer } from '../entities/timer.entity';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';

@Injectable()
export class TimerService {


  constructor(
    @Inject(getRepositoryToken(Timer)) private readonly timerRepository: Repository<Timer>,
    @Inject(getRepositoryToken(Task)) private readonly taskRepository: Repository<Task>,
  ) {}

  async create(createTimerDto: CreateTimerDto) {
    const task = await this.taskRepository.findOne({where: {id: createTimerDto.taskId}});
    const timer = this.timerRepository.create({ ...createTimerDto, task });
    return await this.timerRepository.save(timer);
  }

  async findAll() {
    return await this.timerRepository.find();
  }

  async findOne(id: string) {
    return await this.timerRepository.findOne({where: { id }});
  }

  async update(id: string, updateTimerDto: UpdateTimerDto) {
    await this.timerRepository.update(id, updateTimerDto);
    return await this.timerRepository.findOne({where: { id }});
  }

  async remove(id: string) {
    await this.timerRepository.update(id, { deletedAt: new Date() });
    return `This action soft-deletes timer #${id}`;
  }
}
