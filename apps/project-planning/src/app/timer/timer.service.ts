import { CreateTimerDto, UpdateTimerDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Timer } from '../entities/timer.entity';
import { In, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class TimerService {
  constructor(
    @Inject(getRepositoryToken(Timer))
    private readonly timerRepository: Repository<Timer>,
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(createTimerDto: CreateTimerDto, requestingUserId?: string) {
    const task = await this.taskRepository.findOne({
      where: { id: createTimerDto.taskId },
      relations: ['project'],
    });
    if (requestingUserId) {
      assertFound(task, `Task with id ${createTimerDto.taskId} not found`);
      assertProjectAccess(task.project, requestingUserId);
    }
    const timer = this.timerRepository.create({ ...createTimerDto, task });
    return await this.timerRepository.save(timer);
  }

  async findAll(requestingUserId?: string) {
    if (requestingUserId) {
      const accessibleProjectIds = await getAccessibleProjectIds(
        this.projectRepository,
        requestingUserId
      );
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      return await this.timerRepository.find({
        where: { task: { project: { id: In(accessibleProjectIds) } } },
        relations: ['task', 'task.project'],
      });
    }
    return await this.timerRepository.find();
  }

  async findOne(id: string, requestingUserId?: string) {
    const timer = await this.timerRepository.findOne({
      where: { id },
      relations: requestingUserId ? ['task', 'task.project'] : undefined,
    });
    if (requestingUserId) {
      assertFound(timer, `Timer with id ${id} not found`);
      assertProjectAccess(timer.task?.project, requestingUserId);
    }
    return timer;
  }

  async update(
    id: string,
    updateTimerDto: UpdateTimerDto,
    requestingUserId?: string
  ) {
    if (requestingUserId) {
      const timer = await this.timerRepository.findOne({
        where: { id },
        relations: ['task', 'task.project'],
      });
      assertFound(timer, `Timer with id ${id} not found`);
      assertProjectAccess(timer.task?.project, requestingUserId);
    }
    await this.timerRepository.update(id, updateTimerDto);
    return await this.timerRepository.findOne({ where: { id } });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const timer = await this.timerRepository.findOne({
        where: { id },
        relations: ['task', 'task.project'],
      });
      assertFound(timer, `Timer with id ${id} not found`);
      assertProjectAccess(timer.task?.project, requestingUserId);
    }
    await this.timerRepository.update(id, { deletedAt: new Date() });
    return `This action soft-deletes timer #${id}`;
  }
}
