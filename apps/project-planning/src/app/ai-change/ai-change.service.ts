import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateAiChangeDto,
  ReviewAiChangeDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { AiChange } from '../entities/ai-change.entity';

@Injectable()
export class AiChangeService {
  constructor(
    @Inject(getRepositoryToken(AiChange))
    private readonly repository: Repository<AiChange>
  ) {}

  create(dto: CreateAiChangeDto) {
    return this.repository.save(
      this.repository.create({
        ...dto,
        status: 'PENDING',
      })
    );
  }

  findAll(projectId: string) {
    return this.repository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async review(dto: ReviewAiChangeDto, reviewedBy: string) {
    const change = await this.repository.findOne({ where: { id: dto.id } });
    if (!change) {
      throw new NotFoundException(`AI change ${dto.id} was not found`);
    }
    if (change.status !== 'PENDING') {
      throw new Error(`AI change ${dto.id} has already been reviewed`);
    }
    change.status = dto.status;
    change.reviewedBy = reviewedBy;
    change.reviewNote = dto.reviewNote;
    return this.repository.save(change);
  }
}
