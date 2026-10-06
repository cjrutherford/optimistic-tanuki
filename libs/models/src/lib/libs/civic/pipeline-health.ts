import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Daylight's pipeline health, for the operators' page and its alerts (plan
 * slice P5.2): each town's latest run, and the sources that are failing or
 * have gone quiet.
 */

export class PipelineRunSummary {
  @ApiProperty()
  runId!: number;

  /** running, succeeded, partial_success, failed, blocked or skipped-overlap. */
  @ApiProperty()
  status!: string;

  @ApiProperty()
  cadence!: string;

  @ApiProperty()
  startedAt!: string;

  @ApiProperty({ type: String, nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  currentStage!: string | null;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;
}

export class PipelineSourceProblem {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  adapter!: string;

  /** failing: its fetches fail; stale: it has published nothing new for too long. */
  @ApiProperty({ enum: ['failing', 'stale'] })
  status!: 'failing' | 'stale';

  @ApiProperty({ type: Number, nullable: true })
  stalenessDays!: number | null;

  @ApiProperty()
  consecutiveFailures!: number;

  @ApiProperty({ type: String, nullable: true })
  lastSuccessAt!: string | null;
}

export class TownPipelineHealth {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: PipelineRunSummary, nullable: true })
  lastRun!: PipelineRunSummary | null;

  /** Only the sources that need attention. */
  @ApiProperty({ type: [PipelineSourceProblem] })
  problems!: PipelineSourceProblem[];
}

export class PipelineHealthReport {
  /** False when civic-briefing has no locality registry, so nothing is scheduled. */
  @ApiProperty()
  configured!: boolean;

  @ApiProperty()
  checkedAt!: string;

  @ApiProperty({ type: [TownPipelineHealth] })
  towns!: TownPipelineHealth[];
}

/**
 * An operator's request to pull towns' sources and backfill their editions
 * (D31). Without towns, every scheduled town; without days, the history
 * window (180 days).
 */
export class BackfillRequest {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^[a-z0-9-]{2,64}$/u, { each: true })
  towns?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 366 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;
}

export class BackfillStep {
  @ApiProperty()
  town!: string;

  @ApiProperty()
  action!: string;
}

/** The latest backfill: whether it is running, and what each step did. */
export class BackfillStatus {
  @ApiProperty()
  running!: boolean;

  /** False when no town registry is configured, so nothing can run. */
  @ApiProperty()
  configured!: boolean;

  @ApiProperty({ type: [String] })
  towns!: string[];

  @ApiProperty({ type: Number, nullable: true })
  days!: number | null;

  @ApiProperty({ type: String, nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ type: [BackfillStep] })
  steps!: BackfillStep[];

  /** Why a backfill did not start or did not finish. */
  @ApiProperty({ type: String, nullable: true })
  problem!: string | null;
}
