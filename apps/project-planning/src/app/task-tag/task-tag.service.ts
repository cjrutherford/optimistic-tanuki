import {
  CreateTaskTagDto,
  UpdateTaskTagDto,
  QueryTaskTagDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskTag } from '../entities/task-tag.entity';
import { Repository, FindOptionsWhere, IsNull, Like, Not, In } from 'typeorm';

@Injectable()
export class TaskTagService {
  constructor(
    @Inject(getRepositoryToken(TaskTag))
    private readonly taskTagRepository: Repository<TaskTag>
  ) {}

  async create(createDto: CreateTaskTagDto) {
    const taskTag = this.taskTagRepository.create({
      ...createDto,
      updatedBy: createDto.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.taskTagRepository.save(taskTag);
  }

  async findAll(query: QueryTaskTagDto) {
    const where: FindOptionsWhere<TaskTag> = {
      deletedAt: IsNull(),
    };

    if (query.name) {
      where.name = Like(`%${query.name}%`);
    }

    if (query.deleted) {
      where.deletedAt = Not(IsNull());
    }

    return await this.taskTagRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.taskTagRepository.findOne({
      where: { id },
      relations: ['tasks'],
    });
  }

  async findByIds(ids: string[]) {
    return await this.taskTagRepository.findBy({ id: In(ids) });
  }

  async update(id: string, updateDto: UpdateTaskTagDto) {
    const updateData: Partial<TaskTag> = {
      updatedAt: new Date(),
    };

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }

    if (updateDto.color !== undefined) {
      updateData.color = updateDto.color;
    }

    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    if (updateDto.updatedBy !== undefined) {
      updateData.updatedBy = updateDto.updatedBy;
    }

    await this.taskTagRepository.update(id, updateData);
    return await this.taskTagRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.taskTagRepository.update(id, { deletedAt: new Date() });
    return `Tag #${id} soft-deleted`;
  }
}
