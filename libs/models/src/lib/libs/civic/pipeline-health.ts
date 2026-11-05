import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
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

  /** Discovery has searched this town and adopted nothing, so it is skipped rather than failing (D32). */
  @ApiPropertyOptional()
  noSources?: boolean;

  /** How many readers have asked for sources for this town (D32). */
  @ApiPropertyOptional()
  requestCount?: number;
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

/**
 * A name Civic Core read from a town's agendas, awaiting an operator's
 * decision (D33). Accepting it adds it to the town's officials roster with
 * the source the operator supplies.
 */
export class OfficialCandidate {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  townName!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  sourceAgendaId!: string | null;

  @ApiProperty()
  firstSeen!: string;

  @ApiProperty()
  lastSeen!: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  status!: 'pending' | 'accepted' | 'rejected';

  @ApiPropertyOptional({ nullable: true, type: String })
  decidedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  decidedAt!: string | null;

  @ApiProperty({
    description:
      'False when the first acceptance must also supply domains and a callback number source.',
  })
  townHasOfficials!: boolean;
}

export class AcceptOfficialCandidateBody {
  @ApiProperty({ description: 'The office the person holds.' })
  @IsString()
  office!: string;

  @ApiProperty({
    description: 'An https URL where the roster entry is published.',
  })
  @IsString()
  source!: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Government email domains; required for a town with no officials yet.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  domains?: string[];

  @ApiPropertyOptional({
    description: 'An https URL; required for a town with no officials yet.',
  })
  @IsOptional()
  @IsString()
  callbackNumberSource?: string;
}
