import { ApiProperty } from '@nestjs/swagger';

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
