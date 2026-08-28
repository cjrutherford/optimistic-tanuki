import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateAiChangeDto,
  ReviewAiChangeDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { AiChange } from '../entities/ai-change.entity';
import { AiChangeExecutor } from './ai-change.executor';

@Injectable()
export class AiChangeService {
  constructor(
    @Inject(getRepositoryToken(AiChange))
    private readonly repository: Repository<AiChange>,
    private readonly executor: AiChangeExecutor
  ) {}

  create(dto: CreateAiChangeDto) {
    if (!this.executor.canApply(dto.operation)) {
      // Refused at the door. A proposal naming something nobody can apply is
      // a row that can only ever be approved and then fail, which wastes a
      // reviewer's attention on a decision that cannot be carried out.
      throw new BadRequestException(
        `Operation ${dto.operation} cannot be proposed`
      );
    }
    return this.repository.save(
      this.repository.create({
        ...dto,
        status: 'PENDING',
        applied: false,
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

    if (dto.status === 'APPROVED') {
      // The point of the whole flow. Approving performs the change, and the
      // outcome is recorded either way, so an approval that failed to apply
      // does not read as one that worked.
      const result = await this.executor.apply(
        change.operation,
        change.payload,
        change.projectId,
        reviewedBy
      );
      change.applied = result.applied;
      change.appliedEntityId = result.entityId;
      change.applyError = result.error;
    }

    return this.repository.save(change);
  }
}
