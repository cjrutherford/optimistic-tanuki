import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateAiChangeDto,
  ReviewAiChangeDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { AiChange } from '../entities/ai-change.entity';
import { Project } from '../entities/project.entity';
import { AiChangeExecutor } from './ai-change.executor';
import {
  assertFound,
  assertProjectAccess,
} from '../common/project-access.util';

@Injectable()
export class AiChangeService {
  constructor(
    @Inject(getRepositoryToken(AiChange))
    private readonly repository: Repository<AiChange>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>,
    private readonly executor: AiChangeExecutor
  ) {}

  /**
   * The same access check every other command on this service performs.
   *
   * These three handlers were written without one. Proposals carry the whole
   * payload of a pending change, so listing them without a check hands the
   * contents of somebody else's project to anyone who knows its id, and
   * reviewing without one lets a stranger settle a decision that is not
   * theirs to make.
   *
   * Absent requestingUserId means an internal caller, matching the convention
   * in project-access.util: every externally reachable route injects it.
   */
  private async assertCanReach(
    projectId: string,
    requestingUserId?: string
  ): Promise<void> {
    if (!requestingUserId) return;
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    assertFound(project, `Project with id ${projectId} not found`);
    assertProjectAccess(project, requestingUserId);
  }

  async create(dto: CreateAiChangeDto, requestingUserId?: string) {
    if (!this.executor.canApply(dto.operation)) {
      // Refused at the door. A proposal naming something nobody can apply is
      // a row that can only ever be approved and then fail, which wastes a
      // reviewer's attention on a decision that cannot be carried out.
      throw new RpcException({
        statusCode: 400,
        message: `Operation ${dto.operation} cannot be proposed`,
      });
    }
    await this.assertCanReach(dto.projectId, requestingUserId);

    return this.repository.save(
      this.repository.create({
        ...dto,
        status: 'PENDING',
        applied: false,
      })
    );
  }

  async findAll(projectId: string, requestingUserId?: string) {
    await this.assertCanReach(projectId, requestingUserId);

    return this.repository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async review(
    dto: ReviewAiChangeDto,
    reviewedBy: string,
    requestingUserId?: string
  ) {
    const change = await this.repository.findOne({ where: { id: dto.id } });
    if (!change) {
      throw new RpcException({
        statusCode: 404,
        message: `AI change ${dto.id} was not found`,
      });
    }
    await this.assertCanReach(change.projectId, requestingUserId);

    if (change.status !== 'PENDING') {
      // Two reviewers opening the same panel and both pressing approve is an
      // ordinary race, not a server fault. A bare Error reached the browser as
      // a 500 and read as "the assistant is broken" rather than "somebody has
      // already decided this".
      throw new RpcException({
        statusCode: 409,
        message: `AI change ${dto.id} has already been reviewed`,
      });
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
