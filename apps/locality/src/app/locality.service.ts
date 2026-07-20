import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LocalityAssessmentDto,
  LocalityAssessmentQueryDto,
  LocalityObservationInputDto,
  LocalityObservationStateDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { LocalityObservationEntity } from '../entities/locality-observation.entity';
import {
  assessLocalityObservation,
  validateLocalityObservation,
} from './locality-assessor';

export const LOCALITY_NOW = Symbol('LOCALITY_NOW');

@Injectable()
export class LocalityService {
  constructor(
    @InjectRepository(LocalityObservationEntity)
    private readonly repository: Repository<LocalityObservationEntity>,
    @Inject(LOCALITY_NOW)
    private readonly now: () => Date = () => new Date()
  ) {}

  async recordObservation(
    input: LocalityObservationInputDto
  ): Promise<LocalityAssessmentDto> {
    let observedAt: Date;
    try {
      observedAt = validateLocalityObservation(input);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const priorEntity = await this.repository.findOne({
      where: { subjectId: input.subjectId, source: input.source },
      order: { observedAt: 'DESC' },
    });
    const assessment = assessLocalityObservation(
      input,
      priorEntity ? this.toState(priorEntity) : undefined,
      this.now()
    );
    const entity = {
      subjectId: input.subjectId,
      source: input.source,
      lat: input.lat,
      lng: input.lng,
      accuracyMeters: input.accuracyMeters,
      observedAt,
      ...assessment,
    };
    await this.repository.save(
      this.repository.create ? this.repository.create(entity) : entity
    );
    return assessment;
  }

  async getAssessment(
    subjectId: LocalityAssessmentQueryDto['subjectId'],
    source: LocalityAssessmentQueryDto['source']
  ): Promise<LocalityAssessmentDto> {
    if (typeof subjectId !== 'string' || !subjectId.trim()) {
      throw new BadRequestException('subjectId must be a non-empty string');
    }
    if (source !== 'live-playback') {
      throw new BadRequestException('source must be live-playback');
    }

    const entity = await this.repository.findOne({
      where: { subjectId, source },
      order: { observedAt: 'DESC' },
    });
    if (!entity) {
      return {
        status: 'unverified',
        confidenceScore: 0,
        reasons: ['no-observation'],
        observedAt: null,
        action: 'observe',
      };
    }
    return this.toAssessment(entity);
  }

  private toState(
    entity: LocalityObservationEntity
  ): LocalityObservationStateDto {
    return {
      subjectId: entity.subjectId,
      source: entity.source,
      lat: entity.lat,
      lng: entity.lng,
      observedAt: entity.observedAt.toISOString(),
    };
  }

  private toAssessment(
    entity: LocalityObservationEntity
  ): LocalityAssessmentDto {
    return {
      status: entity.status,
      confidenceScore: entity.confidenceScore,
      reasons: entity.reasons,
      observedAt: entity.observedAt.toISOString(),
      action: entity.action,
    };
  }
}
